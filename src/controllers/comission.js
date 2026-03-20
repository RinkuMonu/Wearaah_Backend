import CommissionRule from "../models/comission.modal.js"
export const getCommissionPercent = async ({ sellerId, categoryId }) => {

    let rule = await CommissionRule.findOne({
        type: "SELLER",
        sellerId,
        isActive: true,
    });

    if (rule) return rule.commissionPercent;

    rule = await CommissionRule.findOne({
        type: "CATEGORY",
        categoryId,
        isActive: true,
    });

    if (rule) return rule.commissionPercent;

    rule = await CommissionRule.findOne({
        type: "GLOBAL",
        isActive: true,
    });

    return rule?.commissionPercent || 0;
};