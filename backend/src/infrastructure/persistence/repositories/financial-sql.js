// A receipt protects only its own installment. Voiding receipts is a manual
// intervention; the mere passage of time never removes this protection.
export const noReceipt = `NOT EXISTS (SELECT 1 FROM scoped_payments receipt
  WHERE receipt.installment_id=i.id AND receipt.voided_at IS NULL
    AND receipt.amount+receipt.late_fee_amount>0)`;

export const feeRemaining = 'greatest(0,f.amount-f.paid_amount-f.waived_amount)';
