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
  const inactiveForMs = suspendTimeout * 60 * 1000;
  const now = Date.now();
  const allTabs = await chrome.tabs.query({});

  for (const tab of allTabs) {
    const lastAccessed = tab.lastAccessed || now;
    const shouldSuspend =
      !tab.active &&
      !tab.discarded &&
      !tab.pinned &&
      !tab.audible &&
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
chrome.tabGroups.onUpdated.addListener(async (group) => {
  const groups = await chrome.storage.local.get('groups');
  if (groups.groups && groups.groups[group.id]) {
    groups.groups[group.id].collapsed = group.collapsed;
    await chrome.storage.local.set({ groups: groups.groups });
  }
});

// Grup silindiğinde depolamadan kaldır
chrome.tabGroups.onRemoved.addListener(async (group) => {
  const result = await chrome.storage.local.get('groups');
  const groups = result.groups || {};
  delete groups[group.id];
  await chrome.storage.local.set({ groups });
});
