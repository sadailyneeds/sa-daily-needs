# SA Store Daily Needs

## 1. Setup

```bash
npm install
```

`src/firebase/config.js` file-ல உங்க Firebase project-oda config values போடுங்க
(Firebase Console → Project Settings → General → Your apps → SDK config).

## 2. Firebase Console-ல செய்ய வேண்டியவை

1. **Authentication** → Sign-in method → **Phone** enable பண்ணுங்க.
2. **Authentication** → Settings → Authorized domains-ல உங்க domain (localhost already இருக்கும்) add பண்ணுங்க.
3. **Firestore Database** create பண்ணி, `firestore.rules` file-ல இருக்கிற rules-ஐ Firebase Console → Firestore → Rules-ல paste பண்ணி Publish பண்ணுங்க.
4. **Storage** enable பண்ணி, `storage.rules` file-ல இருக்கிற rules-ஐ paste பண்ணி Publish பண்ணுங்க.
5. Test phone numbers (OTP வராம SMS charge ஆகாம test பண்ண): Authentication → Sign-in method → Phone → Phone numbers for testing.

## 3. முதல் Admin (Store Owner) create பண்றது எப்படி

1. App-ல் ஒரு முறை உங்க phone number-ஆ register/login பண்ணுங்க (customer-ஆ create ஆகும்).
2. Firebase Console → Firestore → `users` collection → உங்க uid document-ஐ திறந்து,
   `role` field-ஐ `"customer"` இருந்து `"admin"`-ஆ மாத்துங்க.
3. Logout பண்ணி மறுபடி login பண்ணுங்க → இப்போ Navbar-ல "Admin" link தெரியும்.

## 4. Razorpay Online Payment Setup

1. https://dashboard.razorpay.com → Settings → API Keys → Key ID எடுங்க.
2. `src/pages/Checkout.jsx`-ல `RAZORPAY_KEY` variable-ல paste பண்ணுங்க.
3. ⚠️ Production-ல Razorpay order create பண்றதையும், payment verify பண்றதையும்
   **Cloud Function / backend**-ல தான் பண்ணணும் (Key Secret client-side-ல வைக்கக்கூடாது).
   இந்த code, client-only quick-start version.

## 5. Run

```bash
npm run dev
```

## 6. Deploy (Firebase Hosting)

```bash
npm run build
npm install -g firebase-tools
firebase login
firebase init hosting   # public directory: dist, single-page app: Yes
firebase deploy
```

## 7. Folder Structure

```
src/
  firebase/config.js        -> Firebase init
  context/AuthContext.jsx   -> OTP login/register + role
  components/
    Navbar.jsx
    ProductCard.jsx
  pages/
    AuthOtp.jsx              -> Register + Login (OTP)
    Home.jsx                 -> Product listing, search, categories
    Checkout.jsx             -> COD + Razorpay, writes order + notification
    AdminDashboard.jsx       -> Stats, product list, search/filter
    AddEditProduct.jsx       -> Add/Edit product with image upload+preview
    AdminNotifications.jsx   -> Realtime new-order alerts
  styles/                    -> theme.css (brand colors) + per-page CSS
firestore.rules
storage.rules
```
