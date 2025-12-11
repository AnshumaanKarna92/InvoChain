const { z } = require('zod');

const invoiceItemSchema = z.object({
    sku: z.string().min(1, "SKU is required"),
    description: z.string().optional(),
    hsn_code: z.string().optional(),
    quantity: z.number().positive("Quantity must be positive"),
    unit_price: z.number().nonnegative("Unit price must be non-negative"),
    taxable_value: z.number().nonnegative(),
    gst_rate: z.number().min(0).max(100),
    total_item_amount: z.number().nonnegative()
});

const createInvoiceSchema = z.object({
    invoice_number: z.string().min(1, "Invoice number is required"),
    seller_merchant_id: z.string().uuid("Invalid Seller Merchant ID"),
    buyer_gstin: z.string().length(15, "GSTIN must be exactly 15 characters").optional().or(z.literal('')),
    invoice_date: z.string().refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid invoice date format",
    }),
    due_date: z.string().refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid due date format",
    }),
    total_amount: z.number().positive("Total amount must be positive"),
    tax_amount: z.number().nonnegative("Tax amount must be non-negative"),
    items: z.string().transform((str, ctx) => {
        try {
            const parsed = JSON.parse(str);
            if (!Array.isArray(parsed)) throw new Error("Items must be an array");
            return parsed;
        } catch (e) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Invalid JSON string for items",
            });
            return z.NEVER;
        }
    }).pipe(z.array(invoiceItemSchema).min(1, "At least one item is required"))
});

const validateRequest = (schema) => (req, res, next) => {
    try {
        // If it's a multipart request (file upload), the body fields might be strings that need parsing or direct values.
        // req.body from multer is usually just key-value strings.
        // Our schema handles 'items' as a string -> JSON transform.
        // For other numeric fields, we might need to preprocess if they come as strings from multer.

        const dataToValidate = { ...req.body };

        // Pre-process numeric fields if they are strings (common in multipart/form-data)
        ['total_amount', 'tax_amount'].forEach(field => {
            if (typeof dataToValidate[field] === 'string') {
                dataToValidate[field] = parseFloat(dataToValidate[field]);
            }
        });

        const parsed = schema.parse(dataToValidate);
        req.validatedBody = parsed; // Attach validated data to request
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: 'Validation Error',
                errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
            });
        }
        next(error);
    }
};

module.exports = {
    createInvoiceSchema,
    validateRequest
};
