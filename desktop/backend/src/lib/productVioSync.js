const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Builds the URL with session parameters
 */
function getCrutUrl() {
  const origin = process.env.VIO_ORIGIN;
  const wsPath = process.env.VIO_WS_PATH;
  const api = process.env.VIO_API;

  const loginTipi = 'login';
  const user = process.env.VIO_USER || '';
  const pass = process.env.VIO_PASS || '';

  const url = `${origin}/${wsPath}/${api}/?loginTipi=${encodeURIComponent(loginTipi)}&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}&`;
  console.log(url);
  return url;
}

/**
 * 1. Vio'dan tekil Stok verilerini çeken fonksiyon
 */
async function fetchProductsFromVio() {
  try {
    const url = getCrutUrl();
    const payload = {
      trn: false,
      queries: [
        {
          tip: 'select',
          table: 'stkmst'
        }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Vio API Error: ${response.statusText}`);
    }

    const responseText = await response.text();
    let data;
    try {
      data = (responseText && responseText.trim()) ? JSON.parse(responseText.trim()) : {};
    } catch (e) {
      throw new Error('Geçersiz JSON yanıtı alındı');
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

    return rows;
  } catch (error) {
    console.error('Error fetching stkmst from Vio:', error);
    return [];
  }
}

/**
 * Vio'dan stok miktarlarını çeken fonksiyon (sonstok tablosu)
 */
async function fetchStockFromVio() {
  try {
    const url = getCrutUrl();
    const payload = {
      trn: false,
      queries: [
        {
          tip: 'select',
          table: 'sonstok son',
          keys: ['son.stokkod stokKod', 'SUM(son.sonmiktar) topMiktar'],
          groupByListe: ['son.stokkod']
        }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Vio API Error: ${response.statusText}`);
    }

    const responseText = await response.text();
    let data;
    try {
      data = (responseText && responseText.trim()) ? JSON.parse(responseText.trim()) : {};
    } catch (e) {
      throw new Error('Geçersiz JSON yanıtı alındı');
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

    return rows;
  } catch (error) {
    console.error('Error fetching sonstok from Vio:', error);
    return [];
  }
}

/**
 * Fetches a single product from VioTicari by its stock code (kod)
 * @param {string} stockNo - The stock number (kod)
 */
async function fetchSingleVioProduct(stockNo) {
  try {
    const url = getCrutUrl();
    const payload = {
      trn: false,
      queries: [
        {
          tip: 'select',
          table: 'stkmst',
          filters: [`kod = '${stockNo}'`]
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
    try {
      data = (responseText && responseText.trim()) ? JSON.parse(responseText.trim()) : {};
    } catch (e) {
      return null;
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

    if (rows && rows.length > 0) {
      return rows[0];
    }
    return null;
  } catch (error) {
    console.error(`Error fetching single product ${stockNo} from Vio:`, error);
    return null;
  }
}

/**
 * 2. Vio'daki row yapısını Prisma'nın Product yapısına haritalayan (map eden) fonksiyon
 */
function mapVioStokToErpData(row) {
  // aciklama ve aciklama2 birleştiriliyor
  let name = (row.aciklama || '').trim();

  // silindi kolonu 'E' ise veya calismadurumu '*' değilse pasif sayalım.
  // Varsayılan calismadurumu genellikle '*' şeklindedir.
  const isActive = row.silindi !== 'E' && row.calismadurumu !== 'H';

  // Fiyat ve Döviz
  const price = parseFloat(row.satfiyat1) || 0;
  const currency = (row.dvkod || 'TRY').trim();

  // Kategori (grupkod üzerinden) - 'General' yerine '' (boş) kullanıyoruz ki FK hatası vermesin
  const category = (row.grupkod || '').trim();
  
  // Stok miktarı varsa al, yoksa 0 (fetchStockFromVio'dan eklenecek)
  const stock = row.topMiktar ? parseFloat(row.topMiktar) : 0;

  return {
    code: (row.kod || '').trim(), // İç kod olarak da Vio kodunu tutuyoruz
    stockNo: (row.kod || '').trim(), // Arayüzde görünecek Stok No
    name: name,
    description: (row.aciklama2 || '').trim(), // Vio'daki aciklama2'yi description'a çekiyoruz
    category: category,
    unit: (row.brm || 'ADET').trim(),
    currency: currency,
    price: price,
    stock: stock,
    minStock: 0,
    isActive: isActive,
  };
}

/**
 * 3. Vio'dan alınan listeyi Prisma veritabanıyla senkronize eden ana fonksiyon
 */
async function pullProductsFromVio() {
  console.log('\n--- Vio\'dan Tüm Ürünler (Stok Kartları) Çekiliyor ---');
  const products = await fetchProductsFromVio();
  console.log(`Vio'dan toplam ${products.length} ürün kaydı geldi.`);

  console.log('--- Vio\'dan Stok Miktarları (sonstok) Çekiliyor ---');
  const stocks = await fetchStockFromVio();
  console.log(`Vio'dan toplam ${stocks.length} stok kaydı geldi.`);

  // Stok miktarlarını bir Map'te tut (hızlı arama için)
  const stockMap = new Map();
  for (const st of stocks) {
    if (st.stokKod) {
      stockMap.set(st.stokKod.trim(), st.topMiktar);
    }
  }

  // Ürünlere stok miktarını ekle
  for (const p of products) {
    const pCode = (p.kod || '').trim();
    if (stockMap.has(pCode)) {
      p.topMiktar = stockMap.get(pCode);
    } else {
      p.topMiktar = 0;
    }
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const row of products) {
    const productCode = (row.kod || '').trim();
    if (!productCode) continue; // Stok kodu boşsa atla

    // Vio'dan gelenleri kendi ERP şemamıza dönüştürüyoruz
    const mappedData = mapVioStokToErpData(row);

    // Prisma DB'den o stok kodunu sorgula (Önce kullanıcı girişli stockNo, sonra otomatik code alanına bakıyoruz)
    let existingProduct = await prisma.product.findFirst({
      where: { stockNo: productCode },
    });

    if (!existingProduct) {
      existingProduct = await prisma.product.findUnique({
        where: { code: productCode },
      });
    }

    if (!existingProduct) {
      // Ürün DB'de YENİ => Kaydet
        try {
          await prisma.product.create({
            data: mappedData,
          });
          createdCount++;
        } catch (e) {
          if (e.code === 'P2002') {
            console.log(`[VIO SYNC] Race condition avoided for product ${productCode}. Created by another sync.`);
          } else {
            throw e;
          }
        }
    } else {
      // Ürün DB'de VAR => Değişen alan var mı kontrol et
      const diff = {};
      const fieldsToCheck = [
        'name', 'description', 'category', 'unit', 'currency', 'price', 'isActive', 'code', 'stock'
      ];

      for (const field of fieldsToCheck) {
        if (existingProduct[field] !== mappedData[field]) {
          diff[field] = mappedData[field];
        }
      }

      // SADECE değişen bir alan varsa Update gönder
      if (Object.keys(diff).length > 0) {
        await prisma.product.update({
          where: { id: existingProduct.id }, // Mevcut ürünün gerçek ID'sini kullan
          data: diff,
        });
        updatedCount++;
      }
    }
  }

  console.log(`[VIO SYNC] Başarıyla içe aktarılan Yeni Ürünler: ${createdCount}`);
  console.log(`[VIO SYNC] Mevcut verisi Güncellenen Ürünler: ${updatedCount}`);
  console.log('--- Ürün Senkronizasyonu Tamamlandı ---\n');
}

/**
 * Synchronizes product data to VioTicari via CRUT API
 * @param {Object} product - The product object from the database
 * @param {Array<string>} changedFields - Array of field names that were changed (null for creation)
 */
async function syncProductToVio(product, changedFields = null) {
  try {
    const isUpdate = Array.isArray(changedFields);
    if (isUpdate && changedFields.length === 0) {
      console.log(`[VIO SYNC] No fields changed for product ${product.code}, skipping Vio update.`);
      return true;
    }

    const url = getCrutUrl();

    // Map Prisma Product to Vio stkmst format
    const stkmstData = {
      // ERP'deki kullanıcı tarafından girilen "Stock No" alanını Vio'nun ana "kod" alanına gönderiyoruz.
      kod: (product.stockNo || product.code).substring(0, 36)
    };

    if (!isUpdate || changedFields.includes('name')) {
      stkmstData.aciklama = product.name.substring(0, 120);
    }
    if (!isUpdate || changedFields.includes('description')) {
      stkmstData.aciklama2 = (product.description || '').substring(0, 120);
    }
    if (!isUpdate || changedFields.includes('category')) {
      stkmstData.grupkod = (product.category || '').substring(0, 10);
    }
    if (!isUpdate || changedFields.includes('unit')) {
      stkmstData.brm = (product.unit || 'ADET').substring(0, 5);
    }
    if (!isUpdate || changedFields.includes('currency')) {
      stkmstData.dvkod = (product.currency || 'TRY').substring(0, 3);
    }
    if (!isUpdate || changedFields.includes('price')) {
      stkmstData.satfiyat1 = product.price || 0;
    }
    if (!isUpdate || changedFields.includes('isActive')) {
      stkmstData.silindi = product.isActive === false ? 'E' : '';
      stkmstData.calismadurumu = product.isActive === false ? 'H' : '*';
    }

    const payload = {
      trn: true,
      queries: [
        {
          tip: 'insertOrUpdate',
          table: 'stkmst',
          data: [stkmstData]
        }
      ]
    };

    console.log(`[VIO PUSH] Gönderilen Ürün: ${product.code}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`[VIO SYNC ERROR] Failed to sync product ${product.code}: HTTP ${response.status}`);
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
    
    console.log(`[VIO SYNC SUCCESS] Product ${product.code} synced successfully.`);
    return true;

  } catch (error) {
    console.error(`[VIO SYNC CRITICAL ERROR] Could not sync product ${product?.code} to Vio:`, error.stack);
    return false;
  }
}

/**
 * Deletes a product from VioTicari via CRUT API
 * @param {string} productCode - The product code (kod)
 */
async function deleteProductFromVio(productCode) {
  try {
    const url = getCrutUrl();
    const kod = productCode.substring(0, 36);

    const payload = {
      trn: true,
      queries: [
        {
          tip: 'delete',
          table: 'stkmst',
          filters: [`kod = '${kod}'`]
        }
      ]
    };

    console.log(`[VIO DELETE] Ürün Vio'dan siliniyor: ${kod}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`[VIO SYNC ERROR] Failed to delete product ${productCode}: HTTP ${response.status}`);
      const text = await response.text();
      console.error(`[VIO SYNC RESPONSE] ${text}`);
      throw new Error(text);
    }

    const responseText = await response.text();
    let data;
    try {
      data = (responseText && responseText.trim()) ? JSON.parse(responseText.trim()) : {};
    } catch (e) {
      data = responseText;
    }
    
    console.log(`[VIO SYNC SUCCESS] Product ${productCode} deleted successfully from Vio.`);
    return true;

  } catch (error) {
    console.error(`[VIO SYNC CRITICAL ERROR] Could not delete product ${productCode} from Vio:`, error.message);
    throw error;
  }
}

module.exports = {
  fetchProductsFromVio,
  fetchSingleVioProduct,
  pullProductsFromVio,
  mapVioStokToErpData,
  syncProductToVio,
  deleteProductFromVio
};
