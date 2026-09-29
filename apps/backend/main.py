# apps/backend/main.py
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import settings
from services import market_price_service
from db import init_db
from routers import (
    lots, offers, handover, prices, vision, aggregator, reports, payment,
    collectors, demands, opportunities, admin,
    risk, ml, sync, recycler_console, assistant, accounts, pickups, regional,
)
from services.ai_providers import provider_status, warm_up_local_llm
from services.ml_classifier import ml_classifier

init_db()
warm_up_local_llm()

app = FastAPI(
    title="Mai Hu Kabadiwala — E-Waste Platform API",
    description=(
        "E-waste collection, marketplace, reverse marketplace, traceability, "
        "CPCB compliance, fraud detection, ML valuation, offline sync.\n\n"
        "Real: SQLite persistence, PIN verification, CLIP vision (HF API / local), spatial matching, "
        "EPR credits, collectors, demands, opportunity engine, admin, risk engine, "
        "ML valuation, sync batch, recycler console.\n"
        "Simulated (labelled): payment gateway, ARIMA forecast, CPCB report, KYC verification."
    ),
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(lots.router)
app.include_router(offers.router)
app.include_router(handover.router)
app.include_router(prices.router)
app.include_router(vision.router)
app.include_router(aggregator.router)
app.include_router(reports.router)
app.include_router(payment.router)
app.include_router(collectors.router)
app.include_router(demands.router)
app.include_router(opportunities.router)
app.include_router(admin.router)
app.include_router(risk.router)
app.include_router(ml.router)
app.include_router(sync.router)
app.include_router(recycler_console.router)
app.include_router(assistant.router)
app.include_router(accounts.router)
app.include_router(pickups.router)
app.include_router(regional.router)


@app.get("/", tags=["Health"])
def root():
    return {
        "platform": "Mai Hu Kabadiwala API",
        "status": "ONLINE",
        "version": "3.0.0",
        "docs_url": "/docs",
    }


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "components": {
            "database":            {"status": "real",         "backend": "SQLite via SQLAlchemy"},
            "pin_verification":    {"status": "real"},
            "vision_ai":           {"status": "real", **ml_classifier.status()},
            "ai_assistant":        {"status": "real", "providers": provider_status(), "offline_fallback": True},
            "spatial_matching":    {"status": "real"},
            "epr_credits":         {"status": "real"},
            "collectors":          {"status": "real"},
            "households_companies": {"status": "real"},
            "pickup_requests":     {"status": "real"},
            "reverse_marketplace": {"status": "real"},
            "opportunity_engine":  {"status": "real"},
            "admin_dashboard":     {"status": "real"},
            "risk_engine":         {"status": "real",         "detectors": 8},
            "ml_valuation":        {"status": "real",         "method": "gradient-free blend"},
            "demand_prediction":   {"status": "real",         "method": "moving average"},
            "offline_sync":        {"status": "real",         "idempotency": True},
            "recycler_console":    {"status": "real"},
            "kyc_verification":    {"status": "simulated"},
            "national_context":    {"status": "configurable"},
            "market_prices":       market_price_service.status(),
            "rate_cards":          {"status": "configurable", "cities": len(market_price_service.rate_cards().get("cities", {})),
                                    "source": market_price_service.rate_cards().get("source", {}).get("name")},
            "price_forecast":      {"status": "simulated"},
            "payment_gateway":     {"status": "simulated"},
            "cpcb_report":         {"status": "simulated"},
        },
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)