# Home Management App

A modern, full-stack web application for managing household tasks, expenses, and grocery lists. Built with Next.js, TypeScript, and Firebase.

## Features

### 🏠 Dashboard
- Real-time overview of household activities
- Quick access to all main features
- Activity feed showing recent updates
- Team member status and availability

### 👥 Team Management
- Invite and manage team members
- Role-based access control (Owner, Admin, Member)
- Team settings and preferences
- Real-time team collaboration

### 💰 Expense Tracking
- Categorize and track household expenses
- Multiple currency support
- Expense analytics and reports
- Shared expense management

### 🛒 Grocery Management
- Create and manage shopping lists
- Track inventory with units and quantities
- Categorize items by type
- Share lists with team members

### 🧹 Task Management
- Create and assign household tasks
- Set due dates and priorities
- Track task completion status
- Recurring task support

### ⚙️ Settings & Customization
- Theme customization (Light/Dark/System)
- Notification preferences
- Currency settings
- Content management options

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Firebase
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **UI Components**: Radix UI, Shadcn/ui
- **State Management**: React Context
- **Styling**: Tailwind CSS, CSS Modules

## Prerequisites

- Node.js 18.x or later
- npm or yarn
- Firebase account and project
- Git

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/home-management.git
   cd home-management
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env`
   - Fill in your Firebase configuration:
     ```
     NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
     NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
     NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
     NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
     NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
     NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
     ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000) in your browser**

## Project Structure

```
home-management/
├── app/                    # Next.js app directory
│   ├── (auth)/            # Authentication routes
│   ├── dashboard/         # Dashboard and main features
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # UI components
│   └── ...               # Feature-specific components
├── contexts/             # React contexts
├── hooks/                # Custom hooks
├── lib/                  # Utility functions and types
├── public/              # Static assets
└── styles/              # Global styles
```

## Firebase Setup

1. Create a new Firebase project
2. Enable Authentication with Email/Password
3. Create a Firestore database
4. Set up security rules
5. Get your Firebase configuration

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Next.js](https://nextjs.org/)
- [Firebase](https://firebase.google.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)
- [Shadcn/ui](https://ui.shadcn.com/)

## Support

For support, please open an issue in the GitHub repository or contact the maintainers. 