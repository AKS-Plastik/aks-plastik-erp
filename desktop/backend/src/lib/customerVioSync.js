const crypto = require('crypto');

function md5(string) {
  return crypto.createHash('md5').update(string).digest('hex');
}

function toBase64(string) {
  return Buffer.from(string).toString('base64');
}

/**
 * Builds the URL with session parameters
 */
function getCrutUrl() {
  const origin = process.env.VIO_ORIGIN;
  const wsPath = process.env.VIO_WS_PATH;
  const api = process.env.VIO_API;

  const session = {
    loginTipi: 'login',
    user: process.env.VIO_USER,
    // Kullanıcı talebi: Şifreyi MD5 yapmadan direkt düz metin gönder
    pass: process.env.VIO_PASS || ''
  };

  // session parametresi base64url olarak gönderiliyor
  const sessionBase64 = Buffer.from(JSON.stringify(session)).toString('base64url');
  
  // Kullanıcının Postman'de kullandığı orijinal URL'de sql parametresi bulunmuyor
  console.log(`${origin}/${wsPath}/${api}/?session=${sessionBase64}`);
  return `${origin}/${wsPath}/${api}/?session=${sessionBase64}`;
}

/**
 * Synchronizes customer data to VioTicari via CRUT API
 * @param {Object} customer - The customer object from the database
 */
async function syncCustomer(customer) {
  try {
    const url = getCrutUrl();

    // İl dönüşümü için harita
    const cityCodes = {
      'ADANA':'01','ADIYAMAN':'02','AFYON':'03','AĞRI':'04','AMASYA':'05','ANKARA':'06','ANTALYA':'07','ARTVİN':'08','AYDIN':'09','BALIKESİR':'10',
      'BİLECİK':'11','BİNGÖL':'12','BİTLİS':'13','BOLU':'14','BURDUR':'15','BURSA':'16','ÇANAKKALE':'17','ÇANKIRI':'18','ÇORUM':'19','DENİZLİ':'20',
      'DİYARBAKIR':'21','EDİRNE':'22','ELAZIĞ':'23','ERZİNCAN':'24','ERZURUM':'25','ESKİŞEHİR':'26','GAZİANTEP':'27','GİRESUN':'28','GÜMÜŞHANE':'29','HAKKARİ':'30',
      'HATAY':'31','ISPARTA':'32','İÇEL':'33','MERSİN':'33','İSTANBUL':'34','İZMİR':'35','KARS':'36','KASTAMONU':'37','KAYSERİ':'38','KIRKLARELİ':'39','KIRŞEHİR':'40',
      'KOCAELİ':'41','KONYA':'42','KÜTAHYA':'43','MALATYA':'44','MANİSA':'45','KAHRAMANMARAŞ':'46','MARDİN':'47','MUĞLA':'48','MUŞ':'49','NEVŞEHİR':'50',
      'NİĞDE':'51','ORDU':'52','RİZE':'53','SAKARYA':'54','SAMSUN':'55','SİİRT':'56','SİNOP':'57','SİVAS':'58','TEKİRDAĞ':'59','TOKAT':'60',
      'TRABZON':'61','TUNCELİ':'62','ŞANLIURFA':'63','UŞAK':'64','VAN':'65','YOZGAT':'66','ZONGULDAK':'67','AKSARAY':'68','BAYBURT':'69','KARAMAN':'70',
      'KIRIKKALE':'71','BATMAN':'72','ŞIRNAK':'73','BARTIN':'74','ARDAHAN':'75','IĞDIR':'76','YALOVA':'77','KARABÜK':'78','KİLİS':'79','OSMANİYE':'80','DÜZCE':'81'
    };
    
    let ilkod = '';
    if (customer.city) {
      const upperCity = customer.city.trim().toUpperCase('tr-TR');
      ilkod = cityCodes[upperCity] || customer.city.substring(0, 3);
    }

    // Adres işlemi (Sadece adres1 kullanılacak, max 50 karakter)
    const rawAddress = customer.address || '';
    const adres1 = rawAddress.substring(0, 50);

    // Unvan bölme işlemi (Max 50 karakter)
    const rawName = customer.name || '';
    const unvan1 = rawName.substring(0, 50);
    const unvan2 = rawName.substring(50, 100);

    // VKN / TCKN ayrımı
    let vkno = '';
    let tckimlikno = '';
    if (customer.taxId) {
      if (customer.customerType === 'Individual' || customer.taxId.length === 11) {
        tckimlikno = customer.taxId.substring(0, 11);
      } else {
        vkno = customer.taxId.substring(0, 11);
      }
    }

    // Map ERP customer fields to Vio carmst fields
    const carmstData = {
      must: customer.code.substring(0, 16),
      unvan1: unvan1,
      ...(unvan2 && { unvan2: unvan2 }),
      ...(vkno && { vnumara: vkno }), // vkno computed column olduğu için sadece vnumara gönderiyoruz
      ...(tckimlikno && { tckimlikno: tckimlikno }),
      ...(customer.taxOffice && { vdaire: customer.taxOffice.substring(0, 20) }),
      ...(adres1 && { adres1: adres1 }),
      ...(customer.city && { ilkod: customer.city.substring(0, 3) }),
      ...(customer.district && { yore: customer.district.substring(0, 30) }),
      ...(customer.phone && { tel1: customer.phone.substring(0, 15) }),
      ...(customer.contactPhone && { tel2: customer.contactPhone.substring(0, 15) }),
      
      // ERP'deki 4 farklı e-posta alanını Vio'daki ilgili e-posta alanlarıyla eşleştiriyoruz:
      ...(customer.email && { email: customer.email.substring(0, 100) }),
      ...(customer.contactPersonEmail && { emailfinans: customer.contactPersonEmail.substring(0, 100) }), // Finans/Muhasebe e-postası
      ...(customer.contactPersonEmailPurchasing && { emailsatinalma: customer.contactPersonEmailPurchasing.substring(0, 100) }), // Satınalma e-postası
      ...(customer.contactEmail && { emailearsiv: customer.contactEmail.substring(0, 100) }), // Müşteri yetkilisi / e-Arşiv maili olarak kullanılabilir
      
      // İlgili Kişiler (Contact Persons)
      ...(customer.contactName && { ilgili: customer.contactName.substring(0, 35) }),
      ...(customer.contactNamePurchasing && { ilgilisatinalma: customer.contactNamePurchasing.substring(0, 35) }),
      
      // İlgili Kişi Telefonları
      ...(customer.contactPersonPhone && { telfinans: customer.contactPersonPhone.substring(0, 15) }),
      ...(customer.contactPersonPhonePurchasing && { telsatinalma: customer.contactPersonPhonePurchasing.substring(0, 15) }),
      
      // UI artık doğrudan kod (01, 34 vb.) göndereceği için direkt atıyoruz
      ...(customer.bolge && { bolgekod: customer.bolge.substring(0, 10) }),
      
      // Vio'da Alıcı/Satıcı ayrımı tipkod üzerinden generic olarak (MUS ve SAT) yapılabilir.
      ...(customer.cariTip === 'Alıcı' && { tipkod: 'MUS' }),
      ...(customer.cariTip === 'Satıcı' && { tipkod: 'SAT' }),
      ...(customer.cariTip === 'Alıcı/Satıcı' && { tipkod: 'MUS' }), // Alıcı/Satıcı için standart MUS gönderilebilir veya boş bırakılabilir.

      // Foreign Key (Yabancı Anahtar) hatası verdiği için caristgrupkod alanını şimdilik iptal ettik.
      ...(customer.mersisNo && { mersisno: customer.mersisNo.substring(0, 16) }),
      ...(customer.ticaretSicil && { ticaretsicilno: customer.ticaretSicil.substring(0, 11) }),
      ...(customer.iban && { ibanno: customer.iban.substring(0, 34) }),
      ...(customer.currency && { dvkod: customer.currency.substring(0, 3) }),
      ...(customer.creditLimit != null && { risklimiti: customer.creditLimit }),
      
      // E-Fatura ve E-Arşiv eşleştirmeleri
      // Vio SQL'de e-Fatura mükellefi ise efaturakullanirmi alanı '1' veya '*' olur.
      ...(customer.eInvoiceStatus && { efaturakullanirmi: '*' }),
      
      // Senaryo Tipi: Basic (Temel) -> 'T', Commercial (Ticari) -> 'M'
      ...(customer.invoiceScenario && { 
        efatsenaryotipi: customer.invoiceScenario === 'Commercial' ? 'M' : 'T' 
      }),
      
      // Eğer ERP'de ayrı bir e-Arşiv maili varsa Vio'nun eMailEArsiv alanına atılır.
      // Yoksa normal email her ikisi için de kullanılır (Zaten yukarıda email alanına atıldı).
    };

    const payload = {
      trn: true,
      queries: [
        {
          tip: 'insertOrUpdate',
          table: 'carmst',
          data: [carmstData]
        }
      ]
    };

    console.log(`[VIO PUSH] Gönderilen Müşteri: ${customer.code}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`[VIO SYNC ERROR] Failed to sync customer ${customer.code}: HTTP ${response.status}`);
      const text = await response.text();
      console.error(`[VIO SYNC RESPONSE] ${text}`);
      return false;
    }

    const responseText = await response.text();
    let data;
    try {
      data = (responseText && responseText.trim()) ? JSON.parse(responseText.trim()) : {};
    } catch (e) {
      data = responseText;
    }
    
    console.log(`[VIO SYNC SUCCESS] Customer ${customer.code} synced successfully.`);
    return true;

  } catch (error) {
    // Catch block ensures the main ERP flow is never interrupted
    console.error(`[VIO SYNC CRITICAL ERROR] Could not sync customer ${customer?.code} to Vio:`, error.stack);
    return false;
  }
}

/**
 * Deletes a customer from VioTicari via CRUT API
 * @param {string} customerCode - The customer code (must)
 */
async function deleteCustomerFromVio(customerCode) {
  try {
    const url = getCrutUrl();
    const mustCode = customerCode.substring(0, 16);

    const payload = {
      trn: true,
      queries: [
        {
          tip: 'delete',
          table: 'carmst',
          filters: [`must = '${mustCode}'`]
        }
      ]
    };

    console.log(`[VIO DELETE] Müşteri Vio'dan siliniyor: ${mustCode}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`[VIO SYNC ERROR] Failed to delete customer ${customerCode}: HTTP ${response.status}`);
      const text = await response.text();
      console.error(`[VIO SYNC RESPONSE] ${text}`);
      return false;
    }

    const responseText = await response.text();
    let data;
    try {
      data = (responseText && responseText.trim()) ? JSON.parse(responseText.trim()) : {};
    } catch (e) {
      data = responseText;
    }
    
    console.log(`[VIO SYNC SUCCESS] Customer ${customerCode} deleted successfully from Vio.`);
    return true;

  } catch (error) {
    console.error(`[VIO SYNC CRITICAL ERROR] Could not delete customer ${customerCode} from Vio:`, error.message);
    return false;
  }
}

/**
 * Pulls all customers from VioTicari and upserts them into ERP
 */
async function pullCustomersFromVio() {
  try {
    const url = getCrutUrl();
    const payload = {
      trn: false,
      queries: [
        {
          tip: 'select',
          table: 'carmst'
        }
      ]
    };

    console.log(`\n--- Vio'dan Tüm Cariler Çekiliyor ---`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`[VIO SYNC ERROR] Failed to pull customers: HTTP ${response.status}`);
      const text = await response.text();
      return { success: false, error: text };
    }

    const responseText = await response.text();
    let data;
    try {
      data = (responseText && responseText.trim()) ? JSON.parse(responseText.trim()) : {};
    } catch (e) {
      return { success: false, error: 'Geçersiz JSON yanıtı alındı' };
    }

    let rows = [];
    if (Array.isArray(data)) {
       if (data[0] && Array.isArray(data[0])) {
           rows = data[0];
       } else if (data[0] && data[0].rows && Array.isArray(data[0].rows)) {
           rows = data[0].rows;
       } else {
           rows = data;
       }
    } else if (data && data.rows && Array.isArray(data.rows)) {
       rows = data.rows;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return { success: true, count: 0, message: 'Vio tarafında çekilecek cari bulunamadı veya format uyumsuz.' };
    }

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    let createdCount = 0;
    let updatedCount = 0;
    
    for (const row of rows) {
      if (!row.must) continue;
      
      const code = row.must.trim();
      const updateData = mapVioRowToErpData(row, code);

      // Var olan müşteriyi kontrol et
      const existingCustomer = await prisma.customer.findUnique({
        where: { code }
      });

      if (existingCustomer) {
        // Sadece farklı olan alanları bul
        const diff = {};
        let hasChanges = false;
        
        for (const [key, value] of Object.entries(updateData)) {
          // Prisma null kullanıyor, Vio boş string getirebilir. İkisini de eşdeğer sayalım.
          const existingValue = existingCustomer[key] === null ? '' : existingCustomer[key];
          const newValue = value === null ? '' : value;
          
          if (existingValue !== newValue) {
            diff[key] = value;
            hasChanges = true;
          }
        }

        if (hasChanges) {
          await prisma.customer.update({
            where: { code },
            data: diff
          });
          updatedCount++;
        }
      } else {
        // Yeni müşteri ekle
        const finalName = updateData.name || code || '';
        const initials = finalName
          .split(' ')
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() || '')
          .join('');

        try {
          await prisma.customer.create({
            data: {
              code,
              ...updateData,
              initials
            }
          });
          createdCount++;
        } catch (e) {
          if (e.code === 'P2002') {
            console.log(`[VIO SYNC] Race condition avoided for customer ${code}. It was created by another concurrent sync.`);
          } else {
            throw e;
          }
        }
      }
    }
    
    await prisma.$disconnect();
    
    console.log(`[VIO SYNC] Yeni Eklenen Cari: ${createdCount}`);
    console.log(`[VIO SYNC] Güncellenen Cari: ${updatedCount}`);
    console.log('--- Cari Senkronizasyonu Tamamlandı ---\n');
    
    return { success: true, count: createdCount + updatedCount };

  } catch (error) {
    console.error(`[VIO SYNC CRITICAL ERROR] Could not pull customers from Vio:`, error.stack);
    return { success: false, error: error.message };
  }
}

module.exports = {
  syncCustomer,
  deleteCustomerFromVio,
  pullCustomersFromVio,
  fetchSingleVioCustomer
};

// --- YARDIMCI FONKSİYONLAR ---

function mapVioRowToErpData(row, code) {
  const reverseCityCodes = {
    '01':'ADANA','02':'ADIYAMAN','03':'AFYON','04':'AĞRI','05':'AMASYA','06':'ANKARA','07':'ANTALYA','08':'ARTVİN','09':'AYDIN','10':'BALIKESİR',
    '11':'BİLECİK','12':'BİNGÖL','13':'BİTLİS','14':'BOLU','15':'BURDUR','16':'BURSA','17':'ÇANAKKALE','18':'ÇANKIRI','19':'ÇORUM','20':'DENİZLİ',
    '21':'DİYARBAKIR','22':'EDİRNE','23':'ELAZIĞ','24':'ERZİNCAN','25':'ERZURUM','26':'ESKİŞEHİR','27':'GAZİANTEP','28':'GİRESUN','29':'GÜMÜŞHANE','30':'HAKKARİ',
    '31':'HATAY','32':'ISPARTA','33':'MERSİN','34':'İSTANBUL','35':'İZMİR','36':'KARS','37':'KASTAMONU','38':'KAYSERİ','39':'KIRKLARELİ','40':'KIRŞEHİR',
    '41':'KOCAELİ','42':'KONYA','43':'KÜTAHYA','44':'MALATYA','45':'MANİSA','46':'KAHRAMANMARAŞ','47':'MARDİN','48':'MUĞLA','49':'MUŞ','50':'NEVŞEHİR',
    '51':'NİĞDE','52':'ORDU','53':'RİZE','54':'SAKARYA','55':'SAMSUN','56':'SİİRT','57':'SİNOP','58':'SİVAS','59':'TEKİRDAĞ','60':'TOKAT',
    '61':'TRABZON','62':'TUNCELİ','63':'ŞANLIURFA','64':'UŞAK','65':'VAN','66':'YOZGAT','67':'ZONGULDAK','68':'AKSARAY','69':'BAYBURT','70':'KARAMAN',
    '71':'KIRIKKALE','72':'BATMAN','73':'ŞIRNAK','74':'BARTIN','75':'ARDAHAN','76':'IĞDIR','77':'YALOVA','78':'KARABÜK','79':'KİLİS','80':'OSMANİYE','81':'DÜZCE'
  };

  let name = (row.unvan1 || '').trim();
  if (row.unvan2) name += ' ' + row.unvan2.trim();
  
  let taxId = (row.vnumara || '').trim();
  if (!taxId && row.tckimlikno) taxId = row.tckimlikno.trim();
  
  const customerType = row.tckimlikno ? 'Individual' : 'Corporate';
  
  let city = row.ilkod || null;
  if (city && reverseCityCodes[city.trim()]) {
     city = reverseCityCodes[city.trim()];
  }

  let cariTip = 'Alıcı';
  if (row.tipkod === 'SAT') cariTip = 'Satıcı';
  
  return {
    name: name || code,
    fullName: customerType === 'Individual' ? (name || code) : null,
    customerType,
    cariTip,
    taxId: taxId || null,
    taxOffice: row.vdaire || null,
    address: row.adres1 || null,
    city: city,
    district: row.yore || null,
    phone: row.tel1 || null,
    contactPhone: row.tel2 || null,
    email: row.email || null,
    contactPersonEmail: row.emailfinans || null,
    contactPersonEmailPurchasing: row.emailsatinalma || null,
    contactEmail: row.emailearsiv || null,
    contactName: row.ilgili || null,
    contactNamePurchasing: row.ilgilisatinalma || null,
    contactPersonPhone: row.telfinans || null,
    contactPersonPhonePurchasing: row.telsatinalma || null,
    mersisNo: row.mersisno || null,
    ticaretSicil: row.ticaretsicilno || null,
    iban: row.ibanno || null,
    creditLimit: row.risklimiti ? parseFloat(row.risklimiti) : null,
    eInvoiceStatus: row.efaturakullanirmi === '*' || row.efaturakullanirmi === '1',
    invoiceScenario: row.efatsenaryotipi === 'M' ? 'Commercial' : 'Basic',
  };
}

async function fetchSingleVioCustomer(code) {
  try {
    const url = getCrutUrl();
    const mustCode = code.substring(0, 16);
    const payload = {
      trn: false,
      queries: [
        {
          tip: 'select',
          table: 'carmst',
          filters: [`must = '${mustCode}'`]
        }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) return null;

    const responseText = await response.text();
    let data;
    try { data = JSON.parse(responseText.trim()); } catch(e) { return null; }

    let rows = [];
    if (Array.isArray(data)) {
       if (data[0] && Array.isArray(data[0])) rows = data[0];
       else if (data[0] && data[0].rows && Array.isArray(data[0].rows)) rows = data[0].rows;
       else rows = data;
    } else if (data && data.rows && Array.isArray(data.rows)) {
       rows = data.rows;
    }

    if (!Array.isArray(rows) || rows.length === 0) return null;
    
    const row = rows[0];
    if (!row || !row.must) return null;
    
    return mapVioRowToErpData(row, mustCode);
  } catch (error) {
    console.error(`[VIO SYNC ERROR] Could not fetch single customer ${code}:`, error.message);
    return null;
  }
}
