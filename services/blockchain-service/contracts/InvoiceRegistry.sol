// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract InvoiceRegistry {
    
    enum InvoiceStatus { ISSUED, ACCEPTED, REJECTED, CANCELLED }

    struct InvoiceRecord {
        string invoiceHash; // SHA-256 hash of the off-chain JSON/PDF
        address seller;
        address buyer;
        InvoiceStatus status;
        uint256 timestamp;
    }

    // Mapping from Invoice Internal ID (UUID string) to Record
    mapping(string => InvoiceRecord) public invoices;
    
    event InvoiceRegistered(string indexed invoiceId, address indexed seller, address indexed buyer);
    event InvoiceStatusUpdated(string indexed invoiceId, InvoiceStatus status);

    function registerInvoice(
        string memory _invoiceId, 
        string memory _invoiceHash, 
        address _buyer
    ) public {
        require(bytes(invoices[_invoiceId].invoiceHash).length == 0, "Invoice already exists");
        
        invoices[_invoiceId] = InvoiceRecord({
            invoiceHash: _invoiceHash,
            seller: msg.sender,
            buyer: _buyer,
            status: InvoiceStatus.ISSUED,
            timestamp: block.timestamp
        });

        emit InvoiceRegistered(_invoiceId, msg.sender, _buyer);
    }

    function updateStatus(string memory _invoiceId, InvoiceStatus _status) public {
        InvoiceRecord storage record = invoices[_invoiceId];
        require(bytes(record.invoiceHash).length != 0, "Invoice not found");
        // Only buyer can accept/reject, Seller can cancel (simplified logic)
        require(msg.sender == record.buyer || msg.sender == record.seller, "Unauthorized");

        record.status = _status;
        emit InvoiceStatusUpdated(_invoiceId, _status);
    }

    function verifyInvoice(string memory _invoiceId, string memory _hashToVerify) public view returns (bool) {
        return keccak256(abi.encodePacked(invoices[_invoiceId].invoiceHash)) == keccak256(abi.encodePacked(_hashToVerify));
    }
}
