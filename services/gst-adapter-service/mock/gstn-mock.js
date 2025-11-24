// Mock GSTN Service - Simulates GSTN API responses
const crypto = require('crypto');
const QRCode = require('qrcode');

class GSTNMock {
    constructor() {
        this.einvoices = [];
        this.gstr1Submissions = [];
    }

    // Generate IRN (Invoice Reference Number)
    generateIRN() {
        return crypto.randomBytes(32).toString('hex');
    }

    // Generate Acknowledgment Number
    generateAckNo() {
        return `ACK${Date.now()}`;
    }

    // Mock: Generate E-Invoice (IRP API)
    async generateEInvoice(einvoiceData) {
        try {
            // Validate basic fields
            if (!einvoiceData.DocDtls || !einvoiceData.DocDtls.No) {
                throw new Error('Invoice number is required');
            }

            if (!einvoiceData.SellerDtls || !einvoiceData.SellerDtls.Gstin) {
                throw new Error('Seller GSTIN is required');
            }

            // Generate IRN and Acknowledgment
            const irn = this.generateIRN();
            const ackNo = this.generateAckNo();
            const ackDate = new Date().toISOString();

            // Generate QR Code
            const qrData = `IRN:${irn}|ACK:${ackNo}|DATE:${ackDate}`;
            const qrCode = await QRCode.toDataURL(qrData);

            // Digitally sign the invoice (mock)
            const signedInvoice = {
                ...einvoiceData,
                Irn: irn,
                AckNo: ackNo,
                AckDt: ackDate,
                SignedInvoice: Buffer.from(JSON.stringify(einvoiceData)).toString('base64')
            };

            // Store in mock database
            this.einvoices.push({
                irn,
                ackNo,
                ackDate,
                invoiceNo: einvoiceData.DocDtls.No,
                signedInvoice,
                qrCode,
                status: 'ACTIVE'
            });

            return {
                success: true,
                Irn: irn,
                AckNo: ackNo,
                AckDt: ackDate,
                SignedInvoice: signedInvoice.SignedInvoice,
                SignedQRCode: qrCode,
                Status: 'ACT',
                EwbNo: null,
                EwbDt: null,
                EwbValidTill: null,
                Remarks: null,
                alert: 'E-Invoice generated successfully (MOCK)'
            };
        } catch (error) {
            return {
                success: false,
                error_code: 'E001',
                error_message: error.message
            };
        }
    }

    // Mock: Cancel E-Invoice
    async cancelEInvoice(irn, cancelReason, cancelRemarks) {
        const einvoice = this.einvoices.find(e => e.irn === irn);

        if (!einvoice) {
            return {
                success: false,
                error_code: 'E002',
                error_message: 'IRN not found'
            };
        }

        if (einvoice.status === 'CANCELLED') {
            return {
                success: false,
                error_code: 'E003',
                error_message: 'E-Invoice already cancelled'
            };
        }

        // Check 24-hour cancellation window (mock - always allow)
        einvoice.status = 'CANCELLED';
        einvoice.cancelDate = new Date().toISOString();
        einvoice.cancelReason = cancelReason;

        return {
            success: true,
            Irn: irn,
            CancelDate: einvoice.cancelDate,
            alert: 'E-Invoice cancelled successfully (MOCK)'
        };
    }

    // Mock: Get E-Invoice Status
    async getEInvoiceStatus(irn) {
        const einvoice = this.einvoices.find(e => e.irn === irn);

        if (!einvoice) {
            return {
                success: false,
                error_code: 'E002',
                error_message: 'IRN not found'
            };
        }

        return {
            success: true,
            Irn: irn,
            AckNo: einvoice.ackNo,
            AckDt: einvoice.ackDate,
            Status: einvoice.status === 'ACTIVE' ? 'ACT' : 'CNL'
        };
    }

    // Mock: Push GSTR-1 Data
    async pushGSTR1(gstr1Data) {
        try {
            if (!gstr1Data.gstin) {
                throw new Error('GSTIN is required');
            }

            const referenceNo = `GSTR1-${Date.now()}`;

            this.gstr1Submissions.push({
                referenceNo,
                gstin: gstr1Data.gstin,
                period: gstr1Data.period,
                submittedAt: new Date().toISOString(),
                status: 'SUBMITTED'
            });

            return {
                success: true,
                reference_no: referenceNo,
                status: 'SUBMITTED',
                message: 'GSTR-1 data pushed successfully (MOCK)'
            };
        } catch (error) {
            return {
                success: false,
                error_code: 'G001',
                error_message: error.message
            };
        }
    }

    // Mock: Get GSTR-1 Filing Status
    async getGSTR1Status(gstin, period) {
        const submission = this.gstr1Submissions.find(
            s => s.gstin === gstin &&
                s.period.month === period.month &&
                s.period.year === period.year
        );

        if (!submission) {
            return {
                success: false,
                error_code: 'G002',
                error_message: 'No submission found for this period'
            };
        }

        return {
            success: true,
            reference_no: submission.referenceNo,
            status: submission.status,
            submitted_at: submission.submittedAt
        };
    }

    // Mock: Get Auth Token
    async getAuthToken(username, password) {
        // Mock authentication
        if (!username || !password) {
            return {
                success: false,
                error_code: 'AUTH001',
                error_message: 'Invalid credentials'
            };
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresIn = 6 * 60 * 60; // 6 hours in seconds

        return {
            success: true,
            access_token: token,
            token_type: 'Bearer',
            expires_in: expiresIn,
            scope: 'einvoice gstr1'
        };
    }
}

module.exports = new GSTNMock();
