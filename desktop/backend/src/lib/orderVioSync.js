const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// REST URL generator
function getVioRestUrl(endpoint, params = {}) {
  const origin = process.env.VIO_ORIGIN;
  const wsPath = process.env.VIO_WS_PATH;

  const searchParams = new URLSearchParams();
  searchParams.append('loginTipi', 'login');
  searchParams.append('user', process.env.VIO_USER || '');
  searchParams.append('pass', process.env.VIO_PASS || '');

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.append(key, value);
    }
  }

  return `${origin}/${wsPath}/${endpoint}/?${searchParams.toString()}`;
}

// Parses DD.MM.YYYY
function parseVioDate(vioDate) {
  if (!vioDate) return new Date();
  const parts = vioDate.split(' ')[0].split('.');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return new Date(`${year}-${month}-${day}`);
  }
  return new Date();
}

/**
 * PULL ORDERS FROM VIO
 */
async function pullOrdersFromVio(days) {
  //try {
  let headersUrl;
  if (days) {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - days);
    const startDateStr = start.toISOString().split('T')[0];

    console.log(`\n--- Pulling orders from Vio (since ${startDateStr}) ---`);
    headersUrl = getVioRestUrl('siparisler', { tarihBasi: startDateStr });
  } else {
    console.log(`\n--- Pulling ALL orders from Vio ---`);
    headersUrl = getVioRestUrl('siparisler');
  }

  const response = await fetch(headersUrl, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  console.log("pull orders from vio req-res:", response);

  if (!response.ok) {
    console.error(`[VIO SYNC] Error fetching orders: ${response.statusText}`);
    return [];
  }

  const headersText = await response.text();
  let headersData = [];
  try {
    headersData = JSON.parse(headersText.trim() || '[]');
  } catch (e) {
    console.error('[VIO SYNC] Error parsing orders response', e);
    return [];
  }

  const orders = Array.isArray(headersData) ? headersData : [];
  console.log(`[VIO SYNC] ${orders.length} sipariş başlığı bulundu. Detaylar çekiliyor...`);

  for (const header of orders) {
    try {
      const fissayac = header.fissayac;
      if (!fissayac) continue;

      const detailsUrl = getVioRestUrl('siparisler_detaylar', { fisSayac: fissayac });
      const detailsResponse = await fetch(detailsUrl, { method: 'GET' });

      let detaylar = [];
      if (detailsResponse.ok) {
        const detailsText = await detailsResponse.text();
        const dData = JSON.parse(detailsText.trim() || '[]');
        detaylar = Array.isArray(dData) ? dData : [];
      } else {
        console.error(`[VIO SYNC] Detaylar çekilemedi for fissayac ${fissayac}`);
      }

      header.detaylar = detaylar; // Attach details
    } catch (err) {
      console.error(`[VIO SYNC] Error fetching details for order ${header.fissayac}`, err);
      header.detaylar = [];
    }
  }

  // Now upsert into ERP
  await syncVioOrdersToErp(orders);
  return orders;
  //} catch (err) {
  //console.error('[VIO SYNC] pullOrdersFromVio error:', err);
  //return [];
  //}
}

async function syncVioOrdersToErp(vioOrders) {
  if (!vioOrders || vioOrders.length === 0) return;

  let createdCount = 0;
  let updatedCount = 0;

  for (const vio of vioOrders) {
    try {
      const externalId = String(vio.fissayac);

      if (!vio.must) {
        console.log(`[VIO SYNC] Order ${externalId} skipped: No customer code (must)`);
        continue;
      }

      const customer = await prisma.customer.findUnique({
        where: { code: String(vio.must).trim() }
      });

      if (!customer) {
        console.log(`[VIO SYNC] Order ${externalId} skipped: Customer code ${vio.must} not found in ERP`);
        continue;
      }

      let existing = await prisma.order.findUnique({
        where: { externalId: externalId },
        include: { items: true }
      });

      const datePart = vio.tarih ? vio.tarih.split(' ')[0] : '';

      // Sipariş Durumu (onayTipi) Mantığı
      let erpStatus = 'Confirmed'; // varsayılan
      const onay = (vio.onayTipi || '').trim();
      if (onay === 'ON') erpStatus = 'Processing'; // Onay Bekliyor
      else if (onay === 'RD') erpStatus = 'Cancelled'; // Reddedildi
      else if (onay === '') erpStatus = 'Confirmed'; // Boş = Onaylı

      // Döviz Kodu Mantığı
      const headCurrency = (vio.dvkod || '').trim().toUpperCase();
      let orderCurrency = 'TRY';
      if (headCurrency && headCurrency !== 'TL' && headCurrency !== 'TRY') {
        orderCurrency = headCurrency; // Örn: USD, EUR
      }

      const baseOrderData = {
        orderDate: parseVioDate(datePart),
        notes: [vio.aciklama, vio.sevkadi, vio.sevkadres].filter(Boolean).join(' '),
        totalAmount: Number(vio.sonuc) || 0,
        vat: Number(vio.topkdv) || 0,
        status: erpStatus
      };

      const detaylar = vio.detaylar || [];
      const mappedCustomerId = customer.id;

      if (!existing) {
        // CREATE
        const newCode = `${vio.seri || 'VIO'}-${vio.no || externalId}-${Date.now().toString().slice(-4)}`;

        try {
          const created = await prisma.order.create({
            data: {
              ...baseOrderData,
              code: newCode,
              externalId: externalId,
              customer: {
                connect: {
                  id: mappedCustomerId
                }
              },
              items: {
                create: detaylar.map(d => ({
                  productCode: d.stokkod || d.stokKod || '',
                  quantity: Number(d.miktar) || 0,
                  unitPrice: Number(d.fiyat) || 0,
                  vat: Number(d.kdv) || Number(d.kdvOrani) || 0,
                  productName: d.stokadi || d.aciklama || '',
                  currency: d.dvkod ? (d.dvkod.trim().toUpperCase() === 'TL' ? 'TRY' : d.dvkod.trim().toUpperCase()) : orderCurrency
                }))
              }
            }
          });
          console.log(`[VIO SYNC] Order ${externalId} created (ERP id ${created.id}).`);
          createdCount++;
        } catch (e) {
          if (e.code === 'P2002') {
            console.log(`[VIO SYNC] Race condition avoided for order ${externalId}. Created by another sync.`);
          } else {
            throw e;
          }
        }
      } else {
        // UPDATE
        const diff = {};
        if (existing.notes !== baseOrderData.notes) diff.notes = baseOrderData.notes;
        if (existing.totalAmount !== baseOrderData.totalAmount) diff.totalAmount = baseOrderData.totalAmount;
        if (existing.vat !== baseOrderData.vat) diff.vat = baseOrderData.vat;

        if (existing.status !== baseOrderData.status) diff.status = baseOrderData.status;

        const existingDate = existing.orderDate ? existing.orderDate.getTime() : 0;
        const newDate = baseOrderData.orderDate.getTime();
        if (existingDate !== newDate) diff.orderDate = baseOrderData.orderDate;

        let itemsChanged = false;
        if (existing.items.length !== detaylar.length) {
          itemsChanged = true;
        } else {
          for (let i = 0; i < detaylar.length; i++) {
            const d = detaylar[i];
            const e = existing.items[i];
            const pCode = d.stokkod || d.stokKod || '';
            if (e.productCode !== pCode || e.quantity !== (Number(d.miktar) || 0) || e.unitPrice !== (Number(d.fiyat) || 0)) {
              itemsChanged = true;
              break;
            }
          }
        }

        if (Object.keys(diff).length > 0 || itemsChanged) {
          if (Object.keys(diff).length > 0) {
            await prisma.order.update({
              where: { id: existing.id },
              data: diff
            });
          }

          if (itemsChanged && detaylar.length > 0) {
            await prisma.orderItem.deleteMany({ where: { orderId: existing.id } });
            await prisma.orderItem.createMany({
              data: detaylar.map(d => ({
                orderId: existing.id,
                productCode: d.stokkod || d.stokKod || '',
                quantity: Number(d.miktar) || 0,
                unitPrice: Number(d.fiyat) || 0,
                vat: Number(d.kdv) || Number(d.kdvOrani) || 0,
                productName: d.stokadi || d.aciklama || '',
                currency: d.dvkod ? (d.dvkod.trim().toUpperCase() === 'TL' ? 'TRY' : d.dvkod.trim().toUpperCase()) : orderCurrency
              }))
            });
          }
          console.log(`[VIO SYNC] Order ${externalId} updated.`);
          updatedCount++;
        }
      }
    } catch (err) {
      console.error(`[VIO SYNC] Error processing order ${vio.fissayac}:`, err);
    }
  }

  console.log(`[VIO SYNC] Yeni Eklenen Sipariş: ${createdCount}`);
  console.log(`[VIO SYNC] Güncellenen Sipariş: ${updatedCount}`);
  console.log('--- Sipariş Senkronizasyonu Tamamlandı ---\n');
}

/**
 * PUSH ORDER TO VIO
 */
async function pushOrderToVio(orderId) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: { include: { product: true } }
      }
    });

    if (!order || !order.customer) {
      console.log(`[VIO SYNC] Order ${orderId} cannot be pushed (missing or no customer).`);
      return false;
    }

    // Skip if it came from Vio (has externalId) to prevent circular pushing
    if (order.externalId) {
      console.log(`[VIO SYNC] Order ${orderId} skipped (already originated from Vio).`);
      return true;
    }

    const oDate = order.orderDate || order.createdAt;
    const tarih = `${String(oDate.getDate()).padStart(2, '0')}.${String(oDate.getMonth() + 1).padStart(2, '0')}.${oDate.getFullYear()}`;

    const payloadArray = [
      {
        mustKod: order.customer.code,
        tarih: tarih,
        aciklama: order.notes || '',
        onayTipi: '', // Boş göndererek Vio'da "Onaylı" olmasını sağlıyoruz
        detaylar: order.items.map(item => ({
          stokKod: item.productCode || (item.product ? item.product.code : ''),
          miktar: item.quantity,
          fiyat: item.unitPrice,
          kdvOrani: item.vat,
          aciklama: item.productName
        })).filter(d => d.stokKod) // Vio requires a stock code
      }
    ];

    if (payloadArray[0].detaylar.length === 0) {
      console.log(`[VIO SYNC] Order ${orderId} skipped (no items with productCode)`);
      return false;
    }

    const url = getVioRestUrl('siparisKaydet');

    console.log(`[VIO SYNC] Pushing order ${orderId} to Vio...`);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      body: JSON.stringify(payloadArray)
    });

    if (!response.ok) {
      console.error(`[VIO SYNC] Error pushing order: HTTP ${response.status} ${response.statusText}`);
      return false;
    }

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      result = {};
    }

    if (result && result.isError) {
      console.error(`[VIO SYNC] Vio returned error:`, result);
      return false;
    }

    console.log(`[VIO SYNC] Order ${orderId} successfully pushed to Vio.`);

    // Vio'dan dönen JSON'dan fissayac, seri ve no'yu alıp yerel siparişi kalıcı olarak WEB-12 formatında güncelliyoruz
    let vioResponseData = null;
    if (Array.isArray(result) && result.length > 0) {
      vioResponseData = result[0];
    } else if (result && !result.isError) {
      vioResponseData = result;
    }

    if (vioResponseData) {
      // Vio'nun dönderdiği gerçek JSON alanları: ID, Seri, FisNo (Büyük harf duyarlılığına dikkat)
      const fissayac = vioResponseData.ID || vioResponseData.FisNo || vioResponseData.fissayac || vioResponseData.fisSayac || vioResponseData.id;

      if (fissayac) {
        const seri = vioResponseData.Seri || vioResponseData.seri || 'WEB';
        const no = vioResponseData.FisNo || vioResponseData.no || fissayac;
        const newCode = `${seri}-${no}`; // Örn: WEB-16

        try {
          await prisma.order.update({
            where: { id: orderId },
            data: {
              externalId: String(fissayac),
              code: newCode
            }
          });
          console.log(`[VIO SYNC] Order ${orderId} successfully renamed to ${newCode} with externalId ${fissayac}`);
        } catch (updateErr) {
          console.error(`[VIO SYNC] Error updating local order to ${newCode} (might exist):`, updateErr.message);
        }
      }
    }

    return true;

  } catch (err) {
    console.error(`[VIO SYNC] Exception pushing order ${orderId}:`, err);
    return false;
  }
}

module.exports = {
  pullOrdersFromVio,
  pushOrderToVio
};
