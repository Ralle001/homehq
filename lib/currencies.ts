import type { Currency } from "./types"
import { doc, updateDoc, getDoc } from "firebase/firestore"
import { db } from "./firebase"
import { serverTimestamp } from "firebase/firestore"
import { getExchangeRates, updateExchangeRates } from "./db"

// Common currencies with their symbols and names
export const currencies: Record<string, Currency> = {
  USD: { code: "USD", symbol: "$", name: "US Dollar" },
  EUR: { code: "EUR", symbol: "€", name: "Euro" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound" },
  JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  CAD: { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  CHF: { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
  CNY: { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  INR: { code: "INR", symbol: "₹", name: "Indian Rupee" },
  NZD: { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
  SGD: { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  HKD: { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
  KRW: { code: "KRW", symbol: "₩", name: "South Korean Won" },
  BRL: { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  RUB: { code: "RUB", symbol: "₽", name: "Russian Ruble" },
  ZAR: { code: "ZAR", symbol: "R", name: "South African Rand" },
  HUF: { code: "HUF", symbol: "Ft", name: "Hungarian Forint" },
}

// Function to format currency amount
export function formatCurrencyAmount(amount: number, currencyCode: string): string {
  const currency = currencies[currencyCode]
  if (!currency) return `${amount} ${currencyCode}`

  // Format number with 2 decimal places
  const formattedAmount = amount.toFixed(2)

  // Add currency symbol based on locale
  return `${currency.symbol}${formattedAmount}`
}

// Function to convert amount from one currency to another
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  exchangeRates: Record<string, number>
): number {
  if (fromCurrency === toCurrency) return amount

  // Get the exchange rates for both currencies
  const fromRate = exchangeRates[fromCurrency]
  const toRate = exchangeRates[toCurrency]

  if (!fromRate || !toRate) {
    console.error(`Missing exchange rates for ${fromCurrency} or ${toCurrency}`)
    return amount
  }

  // Convert to primary currency first, then to target currency
  // If fromCurrency is not the primary currency, divide by its rate
  // If toCurrency is not the primary currency, multiply by its rate
  const amountInPrimary = fromCurrency === toCurrency ? amount : amount / fromRate
  return amountInPrimary * toRate
}

// Function to get exchange rate between two currencies
export function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  exchangeRates: Record<string, number>
): number {
  if (fromCurrency === toCurrency) return 1

  const fromRate = exchangeRates[fromCurrency] || 1
  const toRate = exchangeRates[toCurrency] || 1

  return fromRate / toRate
}

// Function to validate currency code
export function isValidCurrencyCode(code: string): boolean {
  return code in currencies
}

// Function to get currency symbol
export function getCurrencySymbol(code: string): string {
  return currencies[code]?.symbol || code
}

// Function to get currency name
export function getCurrencyName(code: string): string {
  return currencies[code]?.name || code
}

// Function to fetch latest exchange rates from an API
export async function fetchLatestExchangeRates(primaryCurrency: string): Promise<Record<string, number>> {
  try {
    // First, check if we have recent rates in our database
    const storedRates = await getExchangeRates(primaryCurrency)
    if (storedRates) {
      const lastUpdate = new Date(storedRates.lastUpdate)
      const now = new Date()
      
      // Check if the last update was today
      const isToday = lastUpdate.getDate() === now.getDate() &&
                     lastUpdate.getMonth() === now.getMonth() &&
                     lastUpdate.getFullYear() === now.getFullYear()
      
      // If rates were updated today, use them
      if (isToday) {
        return storedRates.rates
      }
    }

    // If no recent rates or rates are from a different day, fetch from API
    const response = await fetch(
      `https://open.er-api.com/v6/latest/${primaryCurrency}`,
      {
        next: { revalidate: 86400 }, // Cache for 24 hours
      }
    )

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`)
    }

    const data = await response.json()

    if (!data.rates) {
      throw new Error("Invalid response format from exchange rate API")
    }

    // Convert rates to our format
    const rates: Record<string, number> = {}
    Object.entries(data.rates).forEach(([currency, rate]) => {
      if (currency in currencies) {
        rates[currency] = rate as number
      }
    })

    // Ensure we have at least the primary currency
    rates[primaryCurrency] = 1

    // Store the rates in our database with today's date
    await updateExchangeRates(primaryCurrency, rates)

    return rates
  } catch (error) {
    console.error("Error fetching exchange rates:", error)
    throw error // Let the caller handle the error
  }
}

// Function to update exchange rates for a team
export async function updateTeamExchangeRates(teamId: string, primaryCurrency: string): Promise<void> {
  try {
    // Get the latest rates from our database or API
    const rates = await fetchLatestExchangeRates(primaryCurrency)
    
    // Update the team's exchange rates in the database
    const teamRef = doc(db, "teams", teamId)
    await updateDoc(teamRef, {
      "settings.currency.lastUpdate": serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error updating team exchange rates:", error)
    throw error
  }
}

// Function to update team currency settings
export async function updateTeamCurrencySettings(
  teamId: string,
  primaryCurrency: string,
  supportedCurrencies: string[]
): Promise<void> {
  try {
    const teamRef = doc(db, "teams", teamId)
    const teamDoc = await getDoc(teamRef)
    
    if (!teamDoc.exists()) {
      throw new Error("Team not found")
    }

    const teamData = teamDoc.data()
    
    // Preserve existing settings and update only currency settings
    const updatedSettings = {
      ...teamData.settings,
      currency: {
        primary: primaryCurrency,
        supported: supportedCurrencies,
        lastUpdate: teamData.settings?.currency?.lastUpdate || null
      }
    }

    // Update only the settings field
    await updateDoc(teamRef, {
      settings: updatedSettings,
      updatedAt: serverTimestamp()
    })
  } catch (error) {
    console.error("Error updating team currency settings:", error)
    throw error
  }
} 