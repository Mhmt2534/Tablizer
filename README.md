# Sekme Gruplayici ve RAM Optimize Edici

Chrome icin gelistirilmis basit bir sekme yonetimi eklentisidir. Secili sekmeleri Chrome'un yerlesik sekme gruplarina donusturur ve istenirse aktif olmayan sekmeleri askiya alarak bellek kullanimini azaltmaya yardimci olur.

## Ozellikler

- Secili sekmeleri tek tikla gruplama
- Grup adi ve renk secimi
- Mevcut gruplari popup uzerinden listeleme
- Gruptaki ilk sekmeye hizli gecis
- Aktif olmayan grup sekmelerini manuel olarak askiya alma
- Kullanilmayan sekmeleri otomatik askiya almaya calisan arka plan servisi

## RAM Optimizasyonu Nasil Calisir?

Eklenti RAM azaltma icin Chrome'un `chrome.tabs.discard()` API'sini kullanir. Bu API aktif olmayan sekmenin bellek kullanimini bosaltabilir. Sekmeye tekrar gecildiginde sayfa yeniden yuklenir.

Manuel askiya alma islemi popup'taki uyku butonu ile calisir. Otomatik askiya alma ise `background.js` icinde belirlenen sure sonunda aktif olmayan sekmeleri askiya almayi dener.

> Not: Proje Manifest V3 service worker kullandigi icin `setTimeout` tabanli otomatik askiya alma her zaman kalici ve garantili calismayabilir. Daha guvenilir bir otomatik sistem icin `chrome.alarms` API'si tercih edilmelidir.

## Dosya Yapisi

```text
.
├── manifest.json
├── background.js
├── popup.html
├── popup.js
├── icon16.png
├── icon48.png
└── icon128.png
```

## Kurulum

1. Chrome'da `chrome://extensions/` adresini acin.
2. Sag ustten Gelistirici modu'nu etkinlestirin.
3. Paketlenmemis oge yukle butonuna tiklayin.
4. Bu proje klasorunu secin.
5. Eklenti Chrome arac cubugunda gorunur hale gelir.

## Kullanim

1. Chrome'da gruplamak istediginiz sekmeleri secin.
2. Eklenti ikonuna tiklayin.
3. Grup adini yazin.
4. Bir renk secin.
5. Secili Sekmeleri Grupla butonuna tiklayin.

Gruplar popup icinde listelenir. Bir gruba tiklamak o gruptaki ilk sekmeye gecer. Uyku butonu, gruptaki aktif olmayan sekmeleri askiya alir. Silme butonu ise gruptaki sekmeleri kapatir.

## Izinler

Eklenti asagidaki Chrome izinlerini kullanir:

- `tabs`: Sekmeleri listelemek, gruplamak, kapatmak ve askiya almak icin
- `tabGroups`: Chrome sekme gruplarini olusturmak ve guncellemek icin
- `storage`: Grup bilgilerini ve varsayilan ayarlari saklamak icin

## Bilinen Sinirlamalar

- Otomatik askiya alma `setTimeout` kullandigi icin Manifest V3 service worker uykuya gecerse zamanlayici iptal olabilir.
- Silme butonu grubu cozmek yerine gruptaki sekmeleri kapatir.
- Popup arayuzundeki bazi Turkce karakterler dosya kodlamasi nedeniyle bozuk gorunebilir.
- RAM tasarrufu miktari Chrome'un sekmeyi discard etmesine, sekmenin icerigine ve sistem durumuna baglidir.

## Gelistirme Fikirleri

- Otomatik askiya alma icin `chrome.alarms` API'sine gecmek
- Grup silme yerine "grubu coz" secenegi eklemek
- Ayarlar ekranindan otomatik askiya alma suresini degistirmek
- Turkce karakter kodlamasini duzeltmek
- Askida olan sekmeleri popup'ta ayrica gostermek

## Lisans

Bu proje MIT lisansi ile lisanslanmistir. Detaylar icin `LICENSE` dosyasina bakin.
