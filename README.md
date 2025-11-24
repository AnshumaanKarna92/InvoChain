# Automated B2B Invoice Reconciliation & GST Return Filing System

## Overview
This project aims to automate B2B invoice exchange, provide real-time status tracking, and generate pre-filled GST returns. It leverages blockchain for tamper-proof audit logs and integrates with GSTN APIs.

## Tech Stack
- **Frontend**: React (Vite) + TailwindCSS
- **Backend**: Node.js (Express) Microservices
- **Database**: PostgreSQL + Redis
- **Blockchain**: Hyperledger Fabric / Quorum (Simulated/Mocked for initial phases)
- **Storage**: AWS S3 / MinIO

## Project Structure
- `apps/web`: Frontend Web Application
- `services/api-gateway`: Central API Gateway
- `services/auth-service`: Authentication & Onboarding Service
- `services/invoice-service`: Invoice Management (Planned)
- `services/blockchain-service`: Blockchain Interaction (Planned)

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- npm or yarn
- PostgreSQL

### Installation
1. Clone the repository.
2. Install dependencies in each service/app.

### Running Locally
- **Frontend**: `cd apps/web && npm run dev`
- **API Gateway**: `cd services/api-gateway && npm run dev`
