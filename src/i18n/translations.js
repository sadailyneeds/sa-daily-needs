// src/i18n/translations.js
// To add a NEW language: copy the "en" block below, translate every value,
// and add it as a new key (e.g. "hi" for Hindi, "te" for Telugu).
// Then add it to LANGUAGES list in LanguageContext.jsx.

export const translations = {
  ta: {
    appName: "SA Store",
    tagline: "Every need, right here",
    searchPlaceholder: "🔍 அரிசி, பருப்பு, எண்ணெய், பால் தேடுங்க...",
    all: "அனைத்தும்",
    login: "உள்நுழைய",
    profile: "Profile",
    admin: "Admin",
    noProductsFound: "😕 எந்த product-um கிடைக்கல",
    tryDifferentCategory: "வேற category அல்லது search try பண்ணுங்க",

    // Auth
    authTitle: "SA Store",
    authSubtitle: "புதிய காய்கறிகள், வேகமா டெலிவரி",
    name: "பெயர்",
    namePlaceholder: "உங்க பேர்",
    mobileNumber: "மொபைல் நம்பர்",
    sendOtp: "OTP அனுப்புங்க",
    sendingOtp: "OTP அனுப்புகிறோம்...",
    enterOtp: "OTP கொடுங்க",
    verifyContinue: "OTP சரிபார்த்து தொடரவும்",
    verifying: "சரிபார்க்கிறோம்...",
    changeNumber: "நம்பரை மாற்று",
    invalidPhone: "சரியான 10-digit phone number கொடுங்க",
    invalidOtp: "6-digit OTP கொடுங்க",
    otpSendFailed: "OTP அனுப்ப முடியல. மறுபடியும் try பண்ணுங்க.",
    otpWrong: "OTP தவறு. மறுபடியும் try பண்ணுங்க.",

    // Product card
    add: "சேர்",
    buyNow: "உடனே வாங்கு",
    off: "OFF",

    // Checkout
    checkout: "Checkout",
    deliveryAddress: "டெலிவரி முகவரி",
    addressPlaceholder: "வீட்டு முகவரி முழுசா எழுதுங்க (Door No, Street, Area, Pincode)",
    orderSummary: "Order Summary",
    deliveryCharge: "டெலிவரி கட்டணம்",
    total: "மொத்தம்",
    paymentMethod: "பணம் செலுத்தும் முறை",
    cod: "💵 பணமாக டெலிவரியில் (Cash on Delivery)",
    onlinePayment: "💳 GPay / PhonePe / Card / UPI",
    placeOrder: "ஆர்டர் செய்யுங்க",
    placingOrder: "ஆர்டர் செய்யப்படுகிறது...",
    addressRequired: "டெலிவரி முகவரி கொடுங்க",
    orderFailed: "Order place பண்ண முடியல. மறுபடியும் try பண்ணுங்க.",
  },

  en: {
    appName: "SA Store",
    tagline: "Every need, right here",
    searchPlaceholder: "🔍 Search for atta, dal, oil, milk...",
    all: "All",
    login: "Login",
    profile: "Profile",
    admin: "Admin",
    noProductsFound: "😕 No products found",
    tryDifferentCategory: "Try a different category or search",

    // Auth
    authTitle: "SA Store",
    authSubtitle: "Fresh groceries, delivered fast",
    name: "Name",
    namePlaceholder: "Your name",
    mobileNumber: "Mobile Number",
    sendOtp: "Send OTP",
    sendingOtp: "Sending OTP...",
    enterOtp: "Enter OTP",
    verifyContinue: "Verify & Continue",
    verifying: "Verifying...",
    changeNumber: "Change number",
    invalidPhone: "Please enter a valid 10-digit phone number",
    invalidOtp: "Please enter the 6-digit OTP",
    otpSendFailed: "Could not send OTP. Please try again.",
    otpWrong: "Incorrect OTP. Please try again.",

    // Product card
    add: "ADD",
    buyNow: "Buy Now",
    off: "OFF",

    // Checkout
    checkout: "Checkout",
    deliveryAddress: "Delivery Address",
    addressPlaceholder: "Full address (Door No, Street, Area, Pincode)",
    orderSummary: "Order Summary",
    deliveryCharge: "Delivery Charge",
    total: "Total",
    paymentMethod: "Payment Method",
    cod: "💵 Cash on Delivery",
    onlinePayment: "💳 GPay / PhonePe / Card / UPI",
    placeOrder: "Place Order",
    placingOrder: "Placing Order...",
    addressRequired: "Please enter delivery address",
    orderFailed: "Could not place order. Please try again.",
  },
};

export const LANGUAGES = [
  { code: "ta", label: "தமிழ்" },
  { code: "en", label: "English" },
  // Add more here later, e.g. { code: "hi", label: "हिन्दी" }
];
