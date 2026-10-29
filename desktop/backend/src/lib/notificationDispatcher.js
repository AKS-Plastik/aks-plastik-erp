const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendNotification } = require('./onesignal');

/**
 * Finds eligible users for a notification according to strict rules:
 * - Admin or Admin-privileged users
 * - Department managers
 * - Only if they have authority / permissions for the specific section (page).
 * - Excludes non-manager regular staff.
 *
 * @param {string|null} page - Section name e.g. "orders", "production", "purchasing", "finance"
 * @returns {Promise<Array>} List of eligible User records
 */
async function getEligibleUsers(page = null) {
  try {
    const users = await prisma.user.findMany({
      include: {
        employee: true,
      },
    });

    const empIds = users.map((u) => u.employeeId).filter(Boolean);
    const empPermissions = empIds.length
      ? await prisma.employeePermission.findMany({ where: { employeeId: { in: empIds } } })
      : [];

    const rolePerms = await prisma.rolePermission.findMany();

    const isManagerRole = (str) => {
      if (!str) return false;
      const s = String(str).toLowerCase();
      return (
        s.includes('manager') ||
        s.includes('müdür') ||
        s.includes('mudur') ||
        s.includes('yönetici') ||
        s.includes('yonetici')
      );
    };

    const eligible = [];

    for (const u of users) {
      const isAdmin = u.role === 'admin';
      const isDeptManager = Boolean(
        u.employee?.isManager ||
        isManagerRole(u.department) ||
        isManagerRole(u.employee?.department) ||
        isManagerRole(u.employee?.position)
      );

      // Rule: Must be Admin OR Department Manager
      if (!isAdmin && !isDeptManager) {
        continue;
      }

      // If no specific page is defined, all admins & managers get it
      if (!page) {
        eligible.push(u);
        continue;
      }

      // Admins have universal authority over all sections
      if (isAdmin) {
        eligible.push(u);
        continue;
      }

      // For Department Managers: check explicit permission for this page
      const empPerms = u.employeeId
        ? empPermissions.filter((p) => p.employeeId === u.employeeId)
        : [];

      const hasDenial = empPerms.some((p) => p.page === `-${page}`);
      if (hasDenial) continue;

      const hasEmpPerm = empPerms.some((p) => p.page === page);
      if (hasEmpPerm) {
        eligible.push(u);
        continue;
      }

      const userDept = u.department || u.employee?.department;
      if (userDept) {
        const hasRolePerm = rolePerms.some(
          (rp) => rp.role.toLowerCase() === userDept.toLowerCase() && rp.page === page
        );
        if (hasRolePerm) {
          eligible.push(u);
          continue;
        }

        // Implicit department manager match (e.g. Sales Manager has authority over orders)
        const deptLower = userDept.toLowerCase();
        if (
          page === 'orders' &&
          (deptLower.includes('sale') || deptLower.includes('satış') || deptLower.includes('satis'))
        ) {
          eligible.push(u);
          continue;
        }
        if (
          page === 'production' &&
          (deptLower.includes('production') || deptLower.includes('üretim') || deptLower.includes('uretim'))
        ) {
          eligible.push(u);
          continue;
        }
        if (
          page === 'purchasing' &&
          (deptLower.includes('purchas') || deptLower.includes('satın alma') || deptLower.includes('satin alma'))
        ) {
          eligible.push(u);
          continue;
        }
        if (
          page === 'work-orders' &&
          (deptLower.includes('sale') || deptLower.includes('satış') || deptLower.includes('satis') || deptLower.includes('saha') || deptLower.includes('pazarlama'))
        ) {
          eligible.push(u);
          continue;
        }
        if (
          page === 'reports' &&
          (deptLower.includes('sale') || deptLower.includes('satış') || deptLower.includes('satis') || deptLower.includes('saha'))
        ) {
          eligible.push(u);
          continue;
        }
      }
    }

    return eligible;
  } catch (err) {
    console.error('[NotificationDispatcher] Error finding eligible users:', err);
    return [];
  }
}

/**
 * Dispatches a notification to qualifying admins & department managers.
 * Stores in database for in-app notification center and pushes via OneSignal.
 *
 * @param {Object} options
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {string} [options.type='info'] - Notification type ("order", "production", "system", etc.)
 * @param {string|null} [options.page=null] - Target section page ("orders", "production", etc.)
 * @param {string|null} [options.link=null] - Frontend route e.g. "/orders"
 * @param {string|null} [options.excludeUserId=null] - User ID who triggered the action
 */
async function dispatchNotification({
  title,
  body,
  type = 'info',
  page = null,
  link = null,
  excludeUserId = null,
}) {
  try {
    const eligibleUsers = await getEligibleUsers(page);
    const recipients = excludeUserId
      ? eligibleUsers.filter((u) => u.id !== excludeUserId)
      : eligibleUsers;

    if (!recipients.length) {
      console.log(`[NotificationDispatcher] No eligible recipients for page: ${page}`);
      return;
    }

    console.log(
      `[NotificationDispatcher] Sending notification "${title}" to ${recipients.length} recipients:`,
      recipients.map((r) => `${r.name} (${r.role}/${r.department || 'No dept'})`)
    );

    // 1. Save in database for in-app history & bell notification
    try {
      await prisma.notification.createMany({
        data: recipients.map((u) => ({
          userId: u.id,
          title,
          body,
          type,
          page,
          link,
          isRead: false,
        })),
      });
    } catch (dbErr) {
      console.error('[NotificationDispatcher] Database save failed:', dbErr.message);
    }

    // 2. Send Push Notification via OneSignal (using externalIds)
    try {
      const externalIds = Array.from(
        new Set(
          recipients.flatMap((u) => [
            u.id,
            u.employeeId,
            u.email,
          ]).filter(Boolean)
        )
      );
      await sendNotification(title, body, externalIds, link);
    } catch (pushErr) {
      console.error('[NotificationDispatcher] OneSignal push failed:', pushErr.message);
    }
  } catch (err) {
    console.error('[NotificationDispatcher] Failed to dispatch notification:', err);
  }
}

module.exports = {
  getEligibleUsers,
  dispatchNotification,
};
