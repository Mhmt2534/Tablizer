// Otomatik RAM optimizasyonu
chrome.runtime.onInstalled.addListener(() => {
  console.log('Sekme Yöneticisi yüklendi!');
  
  // Varsayılan ayarları kaydet
  chrome.storage.local.set({
    autoSuspend: true,
    suspendTimeout: 30 // 30 dakika
  });
});

// Belirli süre kullanılmayan sekmeleri otomatik askıya al
let tabTimers = {};

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tabId = activeInfo.tabId;
  
  // Aktif sekmeyi işaretle
  clearTimeout(tabTimers[tabId]);
  delete tabTimers[tabId];
  
  // Diğer sekmeleri izlemeye başla
  const settings = await chrome.storage.local.get(['autoSuspend', 'suspendTimeout']);
  
  if (settings.autoSuspend) {
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    
    for (const tab of allTabs) {
      if (tab.id !== tabId && !tab.active && !tab.discarded) {
        clearTimeout(tabTimers[tab.id]);
        
        tabTimers[tab.id] = setTimeout(async () => {
          try {
            await chrome.tabs.discard(tab.id);
            console.log(`Sekme askıya alındı: ${tab.title}`);
          } catch (error) {
            console.log('Sekme askıya alınamadı:', error);
          }
        }, settings.suspendTimeout * 60 * 1000);
      }
    }
  }
});

// Sekme kapatıldığında zamanlayıcıyı temizle
chrome.tabs.onRemoved.addListener((tabId) => {
  clearTimeout(tabTimers[tabId]);
  delete tabTimers[tabId];
});

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