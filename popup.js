let selectedColor = 'blue';
const restoringGroupIds = new Set();
const deletingGroupIds = new Set();

// Renk seçimi
document.querySelectorAll('.color-option').forEach(option => {
  option.addEventListener('click', () => {
    document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
    option.classList.add('selected');
    selectedColor = option.dataset.color;
  });
});

// İlk rengi seç
document.querySelector('[data-color="blue"]').classList.add('selected');

// Grup oluştur
document.getElementById('createGroup').addEventListener('click', async () => {
  const groupName = document.getElementById('groupName').value.trim();
  
  if (!groupName) {
    alert('Lütfen bir grup adı girin!');
    return;
  }

  const windowId = await getCurrentWindowId();

  if (windowId === undefined) {
    alert('Aktif Chrome penceresi bulunamadı!');
    return;
  }

  const tabs = await chrome.tabs.query({ windowId, highlighted: true });
  
  if (tabs.length === 0) {
    alert('Lütfen gruplamak istediğiniz sekmeleri seçin!');
    return;
  }

  const tabIds = tabs.map(tab => tab.id);
  
  const groupId = await chrome.tabs.group({ tabIds });
  await chrome.tabGroups.update(groupId, {
    title: groupName,
    color: selectedColor,
    collapsed: false
  });

  // Grubu kaydet
  const groups = await getGroups();
  groups[groupId] = {
    name: groupName,
    color: selectedColor,
    tabIds: tabIds,
    collapsed: false,
    active: true,
    windowId,
    tabs: tabs
      .filter(tab => tab.url)
      .map(tab => ({
        title: tab.title || tab.url,
        url: tab.url,
        favIconUrl: tab.favIconUrl || ''
      })),
    lastUpdated: Date.now()
  };
  await chrome.storage.local.set({ groups });

  document.getElementById('groupName').value = '';
  loadGroups();
});

// Grupları yükle
async function loadGroups() {
  const groupsList = document.getElementById('groupsList');
  groupsList.innerHTML = '';

  const windowId = await getCurrentWindowId();

  if (windowId === undefined) {
    document.getElementById('tabCount').textContent = '0';
    document.getElementById('groupCount').textContent = '0';
    groupsList.innerHTML = '<div class="empty-state">Aktif Chrome penceresi bulunamadı.</div>';
    return;
  }

  const [allTabs, allGroups] = await Promise.all([
    chrome.tabs.query({ windowId }),
    chrome.tabGroups.query({})
  ]);
  const tabGroups = allGroups.filter(group => group.windowId === windowId);
  await saveActiveGroups(tabGroups, allTabs);

  const savedGroups = await getGroups();
  const activeGroupIds = new Set(tabGroups.map(group => String(group.id)));
  const activeGroupSignatures = new Set(
    tabGroups.map(group => getGroupUrlSignature(allTabs.filter(tab => tab.groupId === group.id)))
  );
  const closedGroups = Object.entries(savedGroups).filter(([groupId, group]) => {
    return (
      !activeGroupIds.has(groupId) &&
      group.windowId === windowId &&
      Array.isArray(group.tabs) &&
      group.tabs.length > 0 &&
      !activeGroupSignatures.has(getGroupUrlSignature(group.tabs))
    );
  });

  document.getElementById('tabCount').textContent = allTabs.length;
  document.getElementById('groupCount').textContent = tabGroups.length;

  if (tabGroups.length === 0 && closedGroups.length === 0) {
    groupsList.innerHTML = '<div class="empty-state">Henüz grup yok.<br>Sekmeleri seçip gruplamaya başlayın!</div>';
    return;
  }

  for (const group of tabGroups) {
    const groupTabs = allTabs.filter(tab => tab.groupId === group.id);
    
    const groupItem = document.createElement('div');
    groupItem.className = 'group-item';

    const groupColor = document.createElement('div');
    groupColor.className = 'group-color';
    groupColor.style.background = getColorHex(group.color);

    const groupInfo = document.createElement('div');
    groupInfo.className = 'group-info';

    const groupName = document.createElement('div');
    groupName.className = 'group-name';
    groupName.textContent = group.title || 'İsimsiz Grup';

    const groupCount = document.createElement('div');
    groupCount.className = 'group-count';
    groupCount.textContent = `${groupTabs.length} sekme${group.collapsed ? ' • Kapalı' : ''}`;

    const groupActions = document.createElement('div');
    groupActions.className = 'group-actions';

    const suspendButton = document.createElement('button');
    suspendButton.className = 'btn-small btn-suspend';
    suspendButton.dataset.groupId = group.id;
    suspendButton.textContent = '💤';
    suspendButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      await suspendGroup(group.id);
    });

    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn-small';
    deleteButton.dataset.groupId = group.id;
    deleteButton.dataset.action = 'delete';
    deleteButton.textContent = '🗑️';
    deleteButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteGroup(group.id);
    });

    groupInfo.append(groupName, groupCount);
    groupActions.append(suspendButton, deleteButton);
    groupItem.append(groupColor, groupInfo, groupActions);

    groupItem.addEventListener('click', async (e) => {
      if (e.target.tagName !== 'BUTTON') {
        const firstTab = groupTabs[0];
        await chrome.tabGroups.update(group.id, { collapsed: false });

        if (firstTab) {
          await chrome.tabs.update(firstTab.id, { active: true });
        }
      }
    });

    groupsList.appendChild(groupItem);
  }

  for (const [savedGroupId, group] of closedGroups) {
    const groupItem = document.createElement('div');
    groupItem.className = 'group-item';

    const groupColor = document.createElement('div');
    groupColor.className = 'group-color';
    groupColor.style.background = getColorHex(group.color);

    const groupInfo = document.createElement('div');
    groupInfo.className = 'group-info';

    const groupName = document.createElement('div');
    groupName.className = 'group-name';
    groupName.textContent = group.name || 'İsimsiz Grup';

    const groupCount = document.createElement('div');
    groupCount.className = 'group-count';
    groupCount.textContent = `${group.tabs.length} sekme • Kapalı grup`;

    const groupActions = document.createElement('div');
    groupActions.className = 'group-actions';

    const restoreButton = document.createElement('button');
    restoreButton.className = 'btn-small btn-suspend';
    restoreButton.textContent = '↩';
    restoreButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      await restoreClosedGroup(savedGroupId);
    });

    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn-small';
    deleteButton.textContent = '🗑️';
    deleteButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteSavedGroup(savedGroupId);
    });

    groupInfo.append(groupName, groupCount);
    groupActions.append(restoreButton, deleteButton);
    groupItem.append(groupColor, groupInfo, groupActions);

    groupItem.addEventListener('click', async () => {
      await restoreClosedGroup(savedGroupId);
    });

    groupsList.appendChild(groupItem);
  }
}

// Grubu askıya al (RAM tasarrufu)
async function suspendGroup(groupId) {
  const tabs = await chrome.tabs.query({ groupId });
  
  for (const tab of tabs) {
    if (!tab.active && !tab.discarded) {
      await chrome.tabs.discard(tab.id);
    }
  }
  
  await chrome.tabGroups.update(groupId, { collapsed: true });
  loadGroups();
}

// Grubu sil
async function deleteGroup(groupId) {
  if (deletingGroupIds.has(groupId)) {
    return;
  }

  deletingGroupIds.add(groupId);
  await markGroupAsDeleted(groupId);
  await deleteSavedGroup(groupId, false);

  try {
    const tabs = await chrome.tabs.query({ groupId });
    await chrome.tabs.remove(tabs.map(tab => tab.id));
  } finally {
    deletingGroupIds.delete(groupId);
    loadGroups();
  }
}

// Yardımcı fonksiyonlar
async function restoreClosedGroup(savedGroupId) {
  if (restoringGroupIds.has(savedGroupId)) {
    return;
  }

  restoringGroupIds.add(savedGroupId);

  const groups = await getGroups();
  const savedGroup = groups[savedGroupId];

  if (!savedGroup || !Array.isArray(savedGroup.tabs) || savedGroup.tabs.length === 0) {
    restoringGroupIds.delete(savedGroupId);
    return;
  }

  delete groups[savedGroupId];
  await chrome.storage.local.set({ groups });
  loadGroups();

  const windowId = await getCurrentWindowId();

  if (windowId === undefined) {
    groups[savedGroupId] = savedGroup;
    await chrome.storage.local.set({ groups });
    restoringGroupIds.delete(savedGroupId);
    alert('Aktif Chrome penceresi bulunamadı!');
    return;
  }

  const createdTabs = [];

  for (const tab of savedGroup.tabs) {
    try {
      const createdTab = await chrome.tabs.create({
        windowId,
        url: tab.url,
        active: false
      });
      createdTabs.push(createdTab);
    } catch (error) {
      console.log('Sekme geri açılamadı:', error);
    }
  }

  if (createdTabs.length === 0) {
    groups[savedGroupId] = savedGroup;
    await chrome.storage.local.set({ groups });
    restoringGroupIds.delete(savedGroupId);
    loadGroups();
    return;
  }

  const tabIds = createdTabs.map(tab => tab.id);
  const groupId = await chrome.tabs.group({ tabIds });
  await chrome.tabGroups.update(groupId, {
    title: savedGroup.name || 'İsimsiz Grup',
    color: savedGroup.color || 'blue',
    collapsed: false
  });
  await chrome.tabs.update(createdTabs[0].id, { active: true });

  const latestGroups = await getGroups();
  latestGroups[groupId] = {
    ...savedGroup,
    active: true,
    collapsed: false,
    windowId,
    tabIds,
    lastUpdated: Date.now()
  };
  await chrome.storage.local.set({ groups: latestGroups });

  restoringGroupIds.delete(savedGroupId);
  loadGroups();
}

async function deleteSavedGroup(savedGroupId, shouldReload = true) {
  const groups = await getGroups();
  delete groups[savedGroupId];
  await chrome.storage.local.set({ groups });

  if (shouldReload) {
    loadGroups();
  }
}

async function markGroupAsDeleted(groupId) {
  const result = await chrome.storage.local.get('deletedGroupIds');
  const deletedGroupIds = result.deletedGroupIds || {};
  deletedGroupIds[String(groupId)] = true;
  await chrome.storage.local.set({ deletedGroupIds });
}

async function saveActiveGroups(tabGroups, allTabs) {
  const groups = await getGroups();

  for (const group of tabGroups) {
    const groupTabs = allTabs.filter(tab => tab.groupId === group.id);
    groups[group.id] = {
      name: group.title || groups[group.id]?.name || 'İsimsiz Grup',
      color: group.color || groups[group.id]?.color || 'blue',
      collapsed: group.collapsed,
      active: true,
      windowId: group.windowId,
      tabIds: groupTabs.map(tab => tab.id),
      tabs: groupTabs
        .filter(tab => tab.url)
        .map(tab => ({
          title: tab.title || tab.url,
          url: tab.url,
          favIconUrl: tab.favIconUrl || ''
        })),
      lastUpdated: Date.now()
    };
  }

  await chrome.storage.local.set({ groups });
}

async function getCurrentWindowId() {
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

  if (activeTab?.windowId !== undefined) {
    return activeTab.windowId;
  }

  const [currentTab] = await chrome.tabs.query({ currentWindow: true });
  return currentTab?.windowId;
}

async function getGroups() {
  const result = await chrome.storage.local.get('groups');
  return result.groups || {};
}

function getColorHex(color) {
  const colors = {
    grey: '#5f6368',
    blue: '#1a73e8',
    red: '#d93025',
    yellow: '#f9ab00',
    green: '#188038',
    pink: '#d01884',
    purple: '#9334e6',
    cyan: '#007b83'
  };
  return colors[color] || colors.blue;
}

function getGroupUrlSignature(tabs) {
  return tabs
    .map(tab => tab.url)
    .filter(Boolean)
    .sort()
    .join('|');
}

// Sayfa yüklendiğinde grupları göster
loadGroups();
