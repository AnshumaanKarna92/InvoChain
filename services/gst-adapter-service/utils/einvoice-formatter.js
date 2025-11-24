// E-Invoice Formatter - Converts internal invoice to GSTN e-invoice JSON format

function formatEInvoice(invoice) {
    const einvoice = {
        Version: "1.1",
        TranDtls: {
            TaxSch: "GST",
            SupTyp: "B2B", // B2B, B2C, SEZWP, SEZWOP, EXPWP, EXPWOP
            RegRev: "N",   // Reverse Charge: Y/N
            IgstOnIntra: "N"
        },
        DocDtls: {
            Typ: "INV",    // INV, CRN, DBN
            No: invoice.invoice_number,
            Dt: formatDate(invoice.invoice_date) // DD/MM/YYYY
        },
        SellerDtls: {
            Gstin: invoice.seller_gstin || "29AABCT1332L000",
            LglNm: invoice.seller_name || "ABC Company Pvt Ltd",
            TrdNm: invoice.seller_trade_name || "ABC Company",
            Addr1: invoice.seller_address || "123, Business Street",
            Addr2: invoice.seller_address2 || "",
            Loc: invoice.seller_city || "Bangalore",
            Pin: invoice.seller_pin || 560001,
            Stcd: invoice.seller_state_code || "29", // Karnataka
            Ph: invoice.seller_phone || "9876543210",
            Em: invoice.seller_email || "seller@example.com"
        },
        BuyerDtls: {
            Gstin: invoice.buyer_gstin || "29AABCT1332L001",
            LglNm: invoice.buyer_name || "XYZ Company Pvt Ltd",
            TrdNm: invoice.buyer_trade_name || "XYZ Company",
            Pos: invoice.place_of_supply || "29", // Place of Supply State Code
            Addr1: invoice.buyer_address || "456, Market Road",
            Addr2: invoice.buyer_address2 || "",
            Loc: invoice.buyer_city || "Bangalore",
            Pin: invoice.buyer_pin || 560002,
            Stcd: invoice.buyer_state_code || "29"
        },
        ItemList: formatItems(invoice.items || []),
        ValDtls: calculateValues(invoice)
    };

    return einvoice;
}

function formatItems(items) {
    return items.map((item, index) => {
        const gstRate = item.tax_rate || 18;
        const assAmt = item.quantity * item.unit_price;
        const discount = item.discount || 0;
        const assAmtAfterDisc = assAmt - discount;

        // Determine IGST/CGST/SGST based on state codes (simplified)
        const igstAmt = assAmtAfterDisc * (gstRate / 100);
        const cgstAmt = 0;
        const sgstAmt = 0;

        return {
            SlNo: String(index + 1),
            PrdDesc: item.description,
            IsServc: item.is_service ? "Y" : "N",
            HsnCd: item.hsn_code || "0000",
            Qty: item.quantity,
            Unit: item.unit || "PCS",
            UnitPrice: item.unit_price,
            TotAmt: assAmt,
            Discount: discount,
            AssAmt: assAmtAfterDisc,
            GstRt: gstRate,
            IgstAmt: igstAmt,
            CgstAmt: cgstAmt,
            SgstAmt: sgstAmt,
            TotItemVal: assAmtAfterDisc + igstAmt
        };
    });
}

function calculateValues(invoice) {
    const assVal = invoice.total_amount - invoice.tax_amount;
    const taxVal = invoice.tax_amount;

    return {
        AssVal: assVal,      // Taxable Value
        CgstVal: 0,          // Central GST
        SgstVal: 0,          // State GST
        IgstVal: taxVal,     // Integrated GST
        CesVal: 0,           // Cess
        StCesVal: 0,         // State Cess
        Discount: 0,
        OthChrg: 0,          // Other Charges
        RndOffAmt: 0,        // Round Off
        TotInvVal: invoice.total_amount,  // Total Invoice Value
        TotInvValFc: 0       // Total in Foreign Currency
    };
}

function formatDate(dateString) {
    // Convert YYYY-MM-DD to DD/MM/YYYY
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

module.exports = {
    formatEInvoice
};
