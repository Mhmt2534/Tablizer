let selectedColor = 'blue';

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
    collapsed: false
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

  const [allTabs, tabGroups] = await Promise.all([
    chrome.tabs.query({ windowId }),
    chrome.tabGroups.query({ windowId })
  ]);

  document.getElementById('tabCount').textContent = allTabs.length;
  document.getElementById('groupCount').textContent = tabGroups.length;

  if (tabGroups.length === 0) {
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
    groupCount.textContent = `${groupTabs.length} sekme`;

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
        if (firstTab) {
          await chrome.tabs.update(firstTab.id, { active: true });
          await chrome.tabGroups.update(group.id, { collapsed: false });
        }
      }
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
  const tabs = await chrome.tabs.query({ groupId });
  await chrome.tabs.remove(tabs.map(tab => tab.id));
  
  const groups = await getGroups();
  delete groups[groupId];
  await chrome.storage.local.set({ groups });
  
  loadGroups();
}

// Yardımcı fonksiyonlar
async function getCurrentWindowId() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

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

// Sayfa yüklendiğinde grupları göster
loadGroups();
