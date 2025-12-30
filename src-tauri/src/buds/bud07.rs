// BUD-07: Payment required
// To be implemented for 402 Payment Required responses

use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct PaymentMethod {
    pub name: String,
    pub payload: String,
}

#[derive(Debug, Clone)]
pub struct PaymentRequired {
    pub methods: Vec<PaymentMethod>,
}

pub struct Bud07;

impl Bud07 {
    pub fn create_payment_required(methods: Vec<PaymentMethod>) -> PaymentRequired {
        PaymentRequired { methods }
    }

    pub fn parse_lightning_invoice(invoice: &str) -> Result<PaymentMethod, String> {
        if !invoice.starts_with("lnbc") && !invoice.starts_with("lnbcrt") {
            return Err("Invalid lightning invoice".to_string());
        }

        Ok(PaymentMethod {
            name: "Lightning".to_string(),
            payload: invoice.to_string(),
        })
    }

    pub fn parse_cashu_token(token: &str) -> Result<PaymentMethod, String> {
        if token.is_empty() {
            return Err("Empty cashu token".to_string());
        }

        Ok(PaymentMethod {
            name: "Cashu".to_string(),
            payload: token.to_string(),
        })
    }
}
