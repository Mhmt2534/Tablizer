const AUTO_SUSPEND_ALARM = 'autoSuspendCheck';
const DEFAULT_SETTINGS = {
  autoSuspend: true,
  suspendTimeout: 1 // dakika
};

// Otomatik RAM optimizasyonu
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Sekme Yöneticisi yüklendi!');

  const settings = await chrome.storage.local.get(['autoSuspend', 'suspendTimeout']);
  await chrome.storage.local.set({
    autoSuspend: settings.autoSuspend ?? DEFAULT_SETTINGS.autoSuspend,
    suspendTimeout: settings.suspendTimeout ?? DEFAULT_SETTINGS.suspendTimeout
  });

  await updateAutoSuspendAlarm();
});

chrome.runtime.onStartup.addListener(updateAutoSuspendAlarm);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && (changes.autoSuspend || changes.suspendTimeout)) {
    updateAutoSuspendAlarm();
  }
});

async function updateAutoSuspendAlarm() {
  const settings = await chrome.storage.local.get(['autoSuspend']);

  if (settings.autoSuspend ?? DEFAULT_SETTINGS.autoSuspend) {
    await chrome.alarms.create(AUTO_SUSPEND_ALARM, { periodInMinutes: 1 });
  } else {
    await chrome.alarms.clear(AUTO_SUSPEND_ALARM);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTO_SUSPEND_ALARM) {
    suspendInactiveTabs();
  }
});

// Belirli süre kullanılmayan sekmeleri otomatik askıya al
async function suspendInactiveTabs() {
  const settings = await chrome.storage.local.get(['autoSuspend', 'suspendTimeout']);

  if (!(settings.autoSuspend ?? DEFAULT_SETTINGS.autoSuspend)) {
    return;
  }

  const suspendTimeout = settings.suspendTimeout ?? DEFAULT_SETTINGS.suspendTimeout;
  const inactiveForMs = suspendTimeout * 5 * 1000;
  const now = Date.now();
  const allTabs = await chrome.tabs.query({});

  for (const tab of allTabs) {
    const lastAccessed = tab.lastAccessed || now;
    const shouldSuspend =
      !tab.active &&
      !tab.discarded &&
      !tab.pinned &&
      !tab.audible &&
      tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE &&
      now - lastAccessed >= inactiveForMs;

    if (!shouldSuspend) {
      continue;
    }

    try {
      await chrome.tabs.discard(tab.id);
      console.log(`Sekme askıya alındı: ${tab.title}`);
    } catch (error) {
      console.log('Sekme askıya alınamadı:', error);
    }
  }
}

// Grup durumunu izle
chrome.tabGroups.onCreated.addListener(saveGroupSnapshot);
chrome.tabGroups.onUpdated.addListener(saveGroupSnapshot);

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if ((changeInfo.title || changeInfo.url || changeInfo.favIconUrl) && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
    try {
      const group = await chrome.tabGroups.get(tab.groupId);
      await saveGroupSnapshot(group);
    } catch (error) {
      console.log('Grup bilgisi güncellenemedi:', error);
    }
  }
});

// Grup kapatıldığında veya silindiğinde depolamadan kaldır.
chrome.tabGroups.onRemoved.addListener(async (group) => {
  const result = await chrome.storage.local.get('groups');
  const groups = result.groups || {};
  delete groups[group.id];
  await chrome.storage.local.set({ groups });
});

async function saveGroupSnapshot(group) {
  try {
    const tabs = await chrome.tabs.query({ groupId: group.id });
    const result = await chrome.storage.local.get('groups');
    const groups = result.groups || {};

    groups[group.id] = {
      name: group.title || groups[group.id]?.name || 'İsimsiz Grup',
      color: group.color || groups[group.id]?.color || 'blue',
      collapsed: group.collapsed,
      active: true,
      windowId: group.windowId,
      tabIds: tabs.map(tab => tab.id),
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
  } catch (error) {
    console.log('Grup kaydı güncellenemedi:', error);
  }
}
