# KRMU Echosense
### Student Environmental Initiative Portal

KRMU Echosense is a web-based environmental portal for students at K.R. Mangalam University. The platform coordinates environmental initiatives, manages student sustainability assessments, and displays campus-wide ecological statistics. 

The architecture uses a static frontend with a serverless backend powered by Netlify Functions, utilizing Firebase for client-side authentication and Firestore for real-time data persistence.

---

## Key Features

* **Student Workspace:** Personalized dashboards to track submitted initiatives, check activity milestones, and complete environmental quizzes.
* **Aggregated Campus Analytics:** Data visualization modules that compile and display university-wide environmental impact metrics.
* **Administrative Operations Control:** A secure admin portal allowing university staff to review student submissions, manage data records, and export impact statistics.
* **Liquid Glass UI:** Modern visual design incorporating fluid dark/light themes, ambient lighting animations, and glassmorphic UI components.
* **Protected Workflows:** Restricts participation to validated university email domains (`@krmu.edu.in`) with automated session verification.

---

## Technical Stack

| Domain | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | HTML5, CSS3, ES6 JavaScript | Semantic page layouts, custom styling properties, and browser state management |
| **Authentication** | Firebase Authentication | Secure student and administrator identity validation |
| **Database** | Firebase Firestore | NoSQL document storage for student responses and analytics datasets |
| **API Backend** | Node.js Serverless Functions | Backend utility processes handled through Netlify Serverless Functions |
| **Hosting Platform** | Netlify | Static asset distribution, serverless function routing, and build pipelines |

---

## System Architecture & Data Flow

```mermaid
graph TD
    subgraph Client [Client Browser]
        UI[Liquid Glass UI]
        Auth[Firebase SDK Client]
        Guard[Session Guard]
    end

    subgraph Serverless [Netlify Serverless Platform]
        Func[Netlify Function: Send Link]
    end

    subgraph FirebaseServices [Firebase Cloud Platform]
        FAuth[Firebase Auth Service]
        FStore[Firestore Database]
    end

    subgraph Communication [Email Services]
        Resend[Resend API]
    end

    UI --> Guard
    Guard -->|Redirect if unauthenticated| UI
    UI -->|API Request| Func
    Func -->|Trigger Authentication Email| Resend
    Resend -->|Delivery| UI
    UI -->|Authenticate Token| Auth
    Auth -->|Exchange Credentials| FAuth
    UI -->|Read/Write Records| FStore
```

---

## Directory Structure

```text
sustainable-web/
├── client/                     # Public web assets (served at root)
│   ├── js/                     # Modular client-side scripts
│   │   ├── admin-auth.js       # Admin portal authorization and session controls
│   │   ├── admin-dashboard.js  # Admin panel UI and collection management
│   │   ├── auth.js             # Student login, sign up, and helper wrappers
│   │   ├── dashboard.js        # Student dashboard actions and form processing
│   │   ├── env-config.js       # Auto-generated client environment variables
│   │   ├── firebase-init.js    # Firebase services initialization and persistence configuration
│   │   ├── glass-shine.js      # Interactive cursor shine effects
│   │   ├── session-guard.js    # Route protection script for authenticated files
│   │   ├── stats.js            # Calculations and layout rendering for statistics
│   │   └── theme.js            # Theme toggling module and system setting observers
│   ├── styles/                 # Styling stylesheets
│   │   ├── components.css      # Core component layout rules
│   │   ├── liquid-glass.css    # Custom glassmorphic designs and animations
│   │   └── tokens.css          # Design system color and spacing variables
│   ├── admin-dashboard.html    # Administration dashboard index page
│   ├── admin-login.html        # Secure portal entrance for administrators
│   ├── dashboard.html          # Student project dashboard panel
│   ├── form.html               # Environmental response quiz and form
│   ├── index.html              # Main login and sign-up page
│   └── stats.html              # Environmental analytics visualization page
├── netlify/                    # Backend serverless configuration
│   └── functions/              # Serviced API routes
│       └── send-link.js        # Authentication email dispatch handler
├── scripts/                    # Development scripts
│   └── generate-config.js      # Client configuration compiler utility
├── .gitignore                  # Active Git ignore rules
├── .mailmap                    # Git author name and email mapping definitions
├── DEPLOY.md                   # Step-by-step production deployment manual
├── firestore.rules             # Data protection rules for Firestore collections
├── netlify.toml                # Netlify redirection mapping and routing rules
└── package.json                # Project dependencies and operational run scripts
```

---

## Getting Started

### System Prerequisites

* **Node.js:** version 18.x or newer is recommended.
* **Firebase Console Access:** A project with Firestore Database and Email/Password Sign-in enabled.
* **Resend Account:** An active API key to manage password reset and notification email operations.

### Local Development Environment Setup

1. **Clone the Repository:**
   ```bash
   git clone <repository-url>
   cd sustainable-web
   ```

2. **Install Node.js Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file at the root of the project. Fill in the parameters with your Firebase and Resend configurations:
   ```ini
   RESEND_API_KEY=re_your_api_key_here
   EMAIL_FROM=noreply@yourdomain.com
   APP_URL=http://localhost:8888
   FRONTEND_URL=http://localhost:8888
   FIREBASE_PROJECT_ID=krmu-impact-bf09e
   FIREBASE_CLIENT_EMAIL=your_service_account_email@krmu-impact.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourKeyBodyHere\n-----END PRIVATE KEY-----\n"
   ```

4. **Launch the Development Proxy Server:**
   Using the Netlify CLI, launch the local development server:
   ```bash
   npx netlify dev
   ```
   The application will boot at `http://localhost:8888`. Netlify CLI automatically hosts the serverless backend functions and forwards API requests matching `/api/*` to the appropriate handler.

---

## Development Operations & Command Reference

The available npm scripts in the project package configuration are defined below:

| Command | Action |
| :--- | :--- |
| `npm run dev` | Runs the Netlify development proxy server, enabling serverless functions and frontend rendering. |
| `npm run build` | Compiles the public client configuration file `js/env-config.js` with active environment settings. |

---

## Security Practices

* **Route Authorization Safeguard:** Files like `dashboard.html` and `form.html` run `js/session-guard.js` before page assets load. If an active authorization cookie or session token is missing, the request redirects immediately to `index.html`.
* **Database Write Constraints:** Read and write queries to the Cloud Firestore database are validated against [firestore.rules](firestore.rules). These rules prevent unauthorized changes by verifying user authentication state and checking email domain compliance.
* **Network Header Policies:** Global HTTP security configurations are managed inside the [netlify.toml](netlify.toml) file. The system enforces policy headers, including `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`.

---

## Production Deployment Workflow

Production hosting is managed on Netlify, and build configurations are resolved automatically.

1. **Connect Repository:**
   Connect the project Git repository to your Netlify dashboard.

2. **Add Environment Settings:**
   Within the Netlify dashboard under **Site Settings** > **Environment Variables**, add the environment variables defined in the `.env` file. Ensure `FIREBASE_PRIVATE_KEY` preserves newline escape sequences (`\n`).

3. **Deploy Build:**
   Deploying changes to the master branch triggers the automated CI/CD pipeline on Netlify. The assets in `/client` are distributed to edge servers, and serverless scripts are compiled using `esbuild`.
