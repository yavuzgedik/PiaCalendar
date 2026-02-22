# PiaCalendar.js

Hafif (Lite), sıfır bağımlılıklı (Vanilla JS), Bootstrap 5 ile tam uyumlu, modern ve akıllı web takvimi kütüphanesi.

PiaCalendar, projelerinize hızlıca entegre edebileceğiniz, dahili CRUD (Ekle, Sil, Güncelle) yeteneklerine sahip ve backend API'lerinizle kolayca haberleşebilen esnek bir araçtır.

## Özellikler

* **Vanilla JS (Sıfır Bağımlılık):** 
jQuery, React veya Vue gerektirmez. Sadece Bootstrap 5 CSS/JS kullanır.  
* **Akıllı DOM İzleme (Pia Felsefesi):** 
MutationObserver sayesinde sayfaya AJAX veya Fetch ile sonradan eklenen takvim elementlerini otomatik tanır ve başlatır.  
* **Backend API Kancaları (Hooks):** 
onFetchEvents, onAddEvent, onUpdateEvent ve onDeleteEvent ile kendi veritabanınıza kolayca bağlayın.  
* **Tam Duyarlı (Responsive):** 
Mobil ve tablet cihazlarda yatay kaydırılabilir, aktif günü vurgulayan akıllı ızgara (grid) yapısı.  
* **Dahili Modal ve Formlar:** 
Etkinlik ekleme ve düzenleme pencereleri kütüphane tarafından otomatik oluşturulur.  
* **İki Farklı Veri Basma Yöntemi:** 
İster AJAX ile dinamik çekin, ister sayfa yüklenirken doğrudan HTML içine JSON olarak (data-pia-events) basın.

## Kurulum

**1. Gereksinimler:** Sayfanızda Bootstrap 5 CSS ve JS bundle'ının bulunduğundan emin olun.

```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"\>  
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script\>
```

**2. PiaCalendar'ı Dahil Edin:**

```html
<script src="PiaCalendar.js"></script>
```

## Kullanım Örnekleri

### > Yöntem 1: Hızlı ve Basit (HTML Üzerinden Veri Basma)

API yazmanıza gerek kalmadan, veritabanınızdaki verileri sayfa render edilirken doğrudan HTML'e basabilirsiniz.

```html
<!-- Takvimin çıkacağı alan -->  
<div   
  data-pia-calendar="true"   
  data-pia-events='[  
    {"title": "Toplantı", "date": "2024-10-15", "color": "primary"},  
    {"title": "Sunum", "date": "2024-10-18", "color": "danger"}  
  ]'>  
</div>

<script>  
    // Sayfadaki takvimleri otomatik bul ve başlat  
    PiaCalendar.observeDOM();  
</script>
```


### > Yöntem 2: Gelişmiş API ve AJAX Entegrasyonu (Önerilen)

Kullanıcı aylar arasında gezinirken veya yeni kayıt eklerken backend'inizle (PHP, Node.js, .NET vb.) iletişim kurun.

```html
<div data-pia-calendar="true"></div>

<script>  
PiaCalendar.observeDOM({  
    // Aylar değiştikçe verileri backend'den çek  
    onFetchEvents: async (year, month) => {  
        const response = await fetch(`/api/takvim?yil=${year}&ay=${month}`);  
        return await response.json();   
    },  
    // Etkinliğe tıklanınca detayları (açıklama vb.) çek  
    onFetchEventDetail: async (id) => {  
        const response = await fetch(`/api/takvim-detay/${id}`);  
        return await response.json();   
    },  
    // Yeni kayıt  
    onAddEvent: async (data) => {  
        const response = await fetch('/api/ekle', {  
            method: 'POST',  
            body: JSON.stringify(data)  
        });  
        return await response.json(); // Eklenen veriyi id'si ile dönmeli  
    },  
    // Güncelleme  
    onUpdateEvent: async (id, data) \=\> {  
        await fetch(`/api/guncelle/${id}`, { method: 'PUT', body: JSON.stringify(data) });  
        return true;  
    },  
    // Silme  
    onDeleteEvent: async (id) => {  
        await fetch(`/api/sil/${id}`, { method: 'DELETE' });  
        return true;  
    }  
});  
</script>
```

## Yapılandırma ve Dil Seçenekleri (Options)

PiaCalendar.observeDOM(options) metoduna gönderebileceğiniz varsayılan ayarlar:


```js
{  
    locale: 'tr-TR', // Tarih formatlama dili  
    startDayOfWeek: 1, // 1: Pazartesi, 0: Pazar  
    theme: 'primary', // Varsayılan etkinlik rengi  
    texts: { // Çoklu dil (i18n) desteği için metinler  
        today: 'Bugün',  
        addEvent: 'Etkinlik Ekle',  
        editEvent: 'Etkinliği Düzenle',  
        save: 'Kaydet',  
        delete: 'Sil',  
        cancel: 'İptal',  
        title: 'Başlık',  
        description: 'Açıklama',  
        loading: 'Yükleniyor...'  
    }
}
```

## Lisans

Bu proje MIT Lisansı ile lisanslanmıştır. Dilediğiniz gibi kullanabilir, değiştirebilir ve dağıtabilirsiniz.
