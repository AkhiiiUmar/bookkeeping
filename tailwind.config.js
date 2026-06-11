/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // NO darkMode — we are pure light mode
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Figma exact brand tokens
        brand: {
          100: "#F4EBFF",
          600: "#7F56D9",
          700: "#6941C6",
          900: "#42307D",
        },
        gray: {
          100: "#F5F5F5",
          400: "#A4A7AE",
          600: "#535862",
          700: "#414651",
          800: "#252937",
          900: "#181D27",
        },
        success: {
          500: "#17B26A",
          800: "#079455",
        },
        danger: {
          600: "#D92D20",
        },
      },
      borderRadius: {
        // Figma: sidebar = 24px, cards = 12px, inputs = 8px, xl = 32px
        'none':  '0',
        'sm':    '0.5rem',    // 8px  — inputs, small elements
        DEFAULT: '0.75rem',   // 12px — cards, containers
        'lg':    '0.75rem',   // 12px
        'xl':    '1rem',      // 16px
        '2xl':   '1.5rem',    // 24px — sidebar, panels
        '3xl':   '2rem',      // 32px — large modals, hero pills
        'full':  '9999px',    // pill badges
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08)',
        'dropdown': '0 8px 24px rgba(0,0,0,0.12)',
        'focus': '0 0 0 3px rgba(127,86,217,0.15)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
