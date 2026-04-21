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

  const tabs = await chrome.tabs.query({ currentWindow: true, highlighted: true });
  
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
  const allTabs = await chrome.tabs.query({ currentWindow: true });
  const tabGroups = await chrome.tabGroups.query({ currentWindow: true });
  
  document.getElementById('tabCount').textContent = allTabs.length;
  document.getElementById('groupCount').textContent = tabGroups.length;

  const groupsList = document.getElementById('groupsList');
  groupsList.innerHTML = '';

  if (tabGroups.length === 0) {
    groupsList.innerHTML = '<div class="empty-state">Henüz grup yok.<br>Sekmeleri seçip gruplamaya başlayın!</div>';
    return;
  }

  for (const group of tabGroups) {
    const groupTabs = allTabs.filter(tab => tab.groupId === group.id);
    
    const groupItem = document.createElement('div');
    groupItem.className = 'group-item';
    groupItem.innerHTML = `
      <div class="group-color" style="background: ${getColorHex(group.color)}"></div>
      <div class="group-info">
        <div class="group-name">${group.title || 'İsimsiz Grup'}</div>
        <div class="group-count">${groupTabs.length} sekme</div>
      </div>
      <div class="group-actions">
        <button class="btn-small btn-suspend" data-group-id="${group.id}">💤</button>
        <button class="btn-small" data-group-id="${group.id}" data-action="delete">🗑️</button>
      </div>
    `;

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

  // Suspend butonları
  document.querySelectorAll('.btn-suspend').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const groupId = parseInt(btn.dataset.groupId);
      await suspendGroup(groupId);
    });
  });

  // Silme butonları
  document.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const groupId = parseInt(btn.dataset.groupId);
      await deleteGroup(groupId);
    });
  });
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