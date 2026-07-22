import { extractJson } from "./extractBasket";
import type { CustomerInfo, CustomerTag } from "./types";

interface LmsPayload {
  customerName?: string;
  customerPhone?: string;
  merchantCustomerId?: string | number;
  qrCodeOrPhoneNumber?: string;
  appUserId?: string | number;
  earn?: number;
  redeem?: number;
  usedCoupon?: { name?: string; discountApplied?: number; couponId?: string }[];
  usedVoucher?: {
    voucherId?: string;
    id?: string;
    usedAmount?: number;
  }[];
}

/**
 * App = GS25 аппын QR-ийг scanner-аар уншуулсан.
 * Сигнал:
 * - RegisterGsrAppUser
 * - MemberCardMn … ID:SCANNER … DEVICE:InputScanner
 * - SEND … /integration/pos/{cardNo} (transaction биш)
 */
function isAppQrScan(text: string): boolean {
  if (/RegisterGsrAppUser/i.test(text)) return true;
  if (
    /MemberCardMnViewPresenter/i.test(text) &&
    /ID:SCANNER/i.test(text) &&
    /DEVICE:InputScanner/i.test(text)
  ) {
    return true;
  }
  // CustInfo API: …/integration/pos/900290… (not …/transaction)
  if (
    /integration\/pos\/(?!transaction)[0-9A-Za-z]+/i.test(text) &&
    /\bSEND\b/.test(text)
  ) {
    return true;
  }
  return false;
}

/** Extract loyalty / app / voucher info from a deal's log slice text. */
export function extractCustomerInfo(texts: string[]): CustomerInfo {
  const tags = new Set<CustomerTag>();
  let name: string | undefined;
  let phone: string | undefined;
  let customerId: string | undefined;
  let pointsEarned: number | undefined;
  let pointsRedeemed: number | undefined;
  let vouchersUsed: CustomerInfo["vouchersUsed"];
  let couponsUsed: CustomerInfo["couponsUsed"];
  let hasLmsCall = false;
  let hasAppQr = false;

  for (const text of texts) {
    if (isAppQrScan(text)) {
      hasAppQr = true;
      hasLmsCall = true;
    }

    const isLmsRelated =
      /ProcessApprovalLMS/i.test(text) ||
      /lms\.dico\.local/i.test(text) ||
      /integration\/pos\//i.test(text) ||
      /MemberCardMn/i.test(text) ||
      /qrCodeOrPhoneNumber|usedVoucher|usedCoupon|appUserId/.test(text);

    if (!isLmsRelated && !hasAppQr) continue;

    if (
      /ProcessApprovalLMS/i.test(text) ||
      /lms\.dico\.local/i.test(text) ||
      /transaction\/start|transaction\/finalize/i.test(text) ||
      /MemberCardMn/i.test(text)
    ) {
      hasLmsCall = true;
    }

    // Phone typed (not App QR)
    if (
      /ProcessInputPhone/i.test(text) ||
      (/MemberCardMnViewPresenter/i.test(text) &&
        /DEVICE:InputKeyboard/i.test(text))
    ) {
      hasLmsCall = true;
    }

    const json = extractJson(text) as LmsPayload | null;
    if (!json) continue;

    if (json.customerName && json.customerName !== "шинэ хэрэглэгч") {
      name = json.customerName;
    } else if (!name && json.customerName) {
      name = json.customerName;
    }
    if (json.customerPhone) phone = String(json.customerPhone);
    if (json.qrCodeOrPhoneNumber && !phone) {
      phone = String(json.qrCodeOrPhoneNumber);
    }
    if (json.merchantCustomerId != null && json.merchantCustomerId !== "") {
      customerId = String(json.merchantCustomerId);
    }
    if (json.appUserId != null && json.appUserId !== "" && !customerId) {
      customerId = String(json.appUserId);
    }

    if (typeof json.earn === "number" && json.earn > 0) {
      pointsEarned = json.earn;
    }
    if (typeof json.redeem === "number" && json.redeem > 0) {
      pointsRedeemed = json.redeem;
      tags.add("points");
    }

    if (Array.isArray(json.usedVoucher) && json.usedVoucher.length > 0) {
      tags.add("voucher");
      vouchersUsed = json.usedVoucher.map((v) => ({
        id: v.voucherId ?? v.id,
        amount: v.usedAmount,
      }));
    }
    if (Array.isArray(json.usedCoupon) && json.usedCoupon.length > 0) {
      tags.add("coupon");
      couponsUsed = json.usedCoupon.map((c) => ({
        name: c.name,
        discountApplied: c.discountApplied,
      }));
    }
  }

  if (hasLmsCall) tags.add("lms");
  // App = зөвхөн scanner-аар QR уншуулсан үед
  if (hasAppQr) tags.add("app");
  if (tags.size === 0) tags.add("guest");

  return {
    tags: Array.from(tags),
    name,
    phone,
    customerId,
    pointsEarned,
    pointsRedeemed,
    vouchersUsed,
    couponsUsed,
  };
}

export const CUSTOMER_TAG_LABELS: Record<CustomerTag, string> = {
  lms: "LMS",
  app: "App QR",
  voucher: "Voucher",
  coupon: "Купон",
  points: "Оноо",
  guest: "Энгийн",
};

export function customerTagLabel(tag: CustomerTag): string {
  return CUSTOMER_TAG_LABELS[tag] ?? tag;
}
