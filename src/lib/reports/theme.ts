// Cob Chronicles Report Theme Configuration
// Based on OG Papio Dynasty League styling guidelines

export const cobChroniclesTheme = {
  // Colors
  colors: {
    parchment: '#f5e6d3',
    parchmentDark: '#e8d4bc',
    headerGreen: '#2d5016',
    accentRust: '#c8553d',
    textPrimary: '#2c2c2c',
    textSecondary: '#555555',
    gold: '#d4af37',
    silver: '#c0c0c0',
    bronze: '#cd7f32',
    toiletBrown: '#8b4513',
    borderDark: '#4a3728',
    borderLight: '#c9b896',
  },
  
  // Typography
  fonts: {
    heading: "'Georgia', 'Times New Roman', serif",
    body: "'Georgia', 'Times New Roman', serif",
    mono: "'Courier New', monospace",
  },
  
  // Font sizes
  fontSize: {
    title: '2.5rem',
    h1: '2rem',
    h2: '1.5rem',
    h3: '1.25rem',
    body: '1rem',
    small: '0.875rem',
    tiny: '0.75rem',
  },
  
  // Spacing
  spacing: {
    section: '2rem',
    paragraph: '1rem',
    inline: '0.5rem',
  },
  
  // Report dimensions (for PDF generation)
  page: {
    width: '8.5in',
    height: '11in',
    margin: '0.75in',
  },
};

// CSS-in-JS styles for report components
export const reportStyles = {
  // Page container
  page: `
    background-color: ${cobChroniclesTheme.colors.parchment};
    font-family: ${cobChroniclesTheme.fonts.body};
    color: ${cobChroniclesTheme.colors.textPrimary};
    padding: 2rem;
    max-width: 850px;
    margin: 0 auto;
  `,
  
  // Main title
  title: `
    font-family: ${cobChroniclesTheme.fonts.heading};
    font-size: ${cobChroniclesTheme.fontSize.title};
    color: ${cobChroniclesTheme.colors.headerGreen};
    text-align: center;
    margin-bottom: 0.5rem;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 2px;
  `,
  
  // Subtitle
  subtitle: `
    font-family: ${cobChroniclesTheme.fonts.heading};
    font-size: ${cobChroniclesTheme.fontSize.h2};
    color: ${cobChroniclesTheme.colors.accentRust};
    text-align: center;
    margin-bottom: 2rem;
    font-style: italic;
  `,
  
  // Section header
  sectionHeader: `
    font-family: ${cobChroniclesTheme.fonts.heading};
    font-size: ${cobChroniclesTheme.fontSize.h2};
    color: ${cobChroniclesTheme.colors.headerGreen};
    border-bottom: 3px solid ${cobChroniclesTheme.colors.headerGreen};
    padding-bottom: 0.5rem;
    margin-top: 2rem;
    margin-bottom: 1rem;
    font-weight: bold;
  `,
  
  // Subsection header
  subsectionHeader: `
    font-family: ${cobChroniclesTheme.fonts.heading};
    font-size: ${cobChroniclesTheme.fontSize.h3};
    color: ${cobChroniclesTheme.colors.accentRust};
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    font-weight: bold;
  `,
  
  // Body text
  bodyText: `
    font-family: ${cobChroniclesTheme.fonts.body};
    font-size: ${cobChroniclesTheme.fontSize.body};
    line-height: 1.6;
    margin-bottom: 1rem;
  `,
  
  // Stat box container
  statBoxContainer: `
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin: 1.5rem 0;
  `,
  
  // Individual stat box
  statBox: `
    background-color: ${cobChroniclesTheme.colors.parchmentDark};
    border: 2px solid ${cobChroniclesTheme.colors.borderDark};
    border-radius: 8px;
    padding: 1rem;
    text-align: center;
  `,
  
  // Stat box label
  statLabel: `
    font-size: ${cobChroniclesTheme.fontSize.small};
    color: ${cobChroniclesTheme.colors.textSecondary};
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 0.25rem;
  `,
  
  // Stat box value
  statValue: `
    font-size: ${cobChroniclesTheme.fontSize.h2};
    font-weight: bold;
    color: ${cobChroniclesTheme.colors.headerGreen};
  `,
  
  // Table styles
  table: `
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
    font-size: ${cobChroniclesTheme.fontSize.small};
  `,
  
  tableHeader: `
    background-color: ${cobChroniclesTheme.colors.headerGreen};
    color: white;
    text-align: left;
    padding: 0.75rem 0.5rem;
    font-weight: bold;
    text-transform: uppercase;
    font-size: ${cobChroniclesTheme.fontSize.tiny};
    letter-spacing: 1px;
  `,
  
  tableCell: `
    padding: 0.5rem;
    border-bottom: 1px solid ${cobChroniclesTheme.colors.borderLight};
  `,
  
  tableRowAlt: `
    background-color: ${cobChroniclesTheme.colors.parchmentDark};
  `,
  
  // Highlight box for important content
  highlightBox: `
    background-color: ${cobChroniclesTheme.colors.parchmentDark};
    border-left: 4px solid ${cobChroniclesTheme.colors.accentRust};
    padding: 1rem;
    margin: 1rem 0;
    font-style: italic;
  `,
  
  // Quote/callout
  callout: `
    background-color: ${cobChroniclesTheme.colors.headerGreen};
    color: white;
    padding: 1.5rem;
    border-radius: 8px;
    margin: 1.5rem 0;
    text-align: center;
    font-size: ${cobChroniclesTheme.fontSize.h3};
    font-style: italic;
  `,
  
  // Footer
  footer: `
    margin-top: 3rem;
    padding-top: 1rem;
    border-top: 2px solid ${cobChroniclesTheme.colors.borderDark};
    text-align: center;
    font-size: ${cobChroniclesTheme.fontSize.small};
    color: ${cobChroniclesTheme.colors.textSecondary};
    font-style: italic;
  `,
  
  // Matchup card
  matchupCard: `
    background-color: ${cobChroniclesTheme.colors.parchmentDark};
    border: 2px solid ${cobChroniclesTheme.colors.borderDark};
    border-radius: 8px;
    padding: 1rem;
    margin: 0.75rem 0;
  `,
  
  // Winner highlight
  winner: `
    color: ${cobChroniclesTheme.colors.headerGreen};
    font-weight: bold;
  `,
  
  // Loser styling
  loser: `
    color: ${cobChroniclesTheme.colors.textSecondary};
  `,
  
  // Rank badges
  rankBadge: {
    gold: `
      background-color: ${cobChroniclesTheme.colors.gold};
      color: #000;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-weight: bold;
    `,
    silver: `
      background-color: ${cobChroniclesTheme.colors.silver};
      color: #000;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-weight: bold;
    `,
    bronze: `
      background-color: ${cobChroniclesTheme.colors.bronze};
      color: #fff;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-weight: bold;
    `,
    toilet: `
      background-color: ${cobChroniclesTheme.colors.toiletBrown};
      color: #fff;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-weight: bold;
    `,
  },
};

// Signature phrases for Supreme Leader SHADdam Hussein persona
export const signaturePhrases = {
  openers: [
    "Greetings, fellow dynasty degenerates.",
    "Welcome back to another edition of The Cob Chronicles.",
    "The Supreme Leader has returned with another dispatch from the front lines.",
    "Settle in, managers. We have much to discuss.",
  ],
  transitions: [
    "But I digress.",
    "Vegas KNOWS.",
    "Word on the street is...",
    "The numbers don't lie — but they do occasionally embellish.",
    "Let's examine the evidence.",
  ],
  closers: [
    "Until next time — may your benches stay healthy and your opponents' stars rest.",
    "The Supreme Leader has spoken.",
    "This has been another edition of The Cob Chronicles. Stay frosty.",
    "Remember: fortune favors the prepared lineup.",
  ],
};

// Report type configurations
export const reportTypes = {
  weeklyRecap: {
    title: 'The Cob Chronicles',
    sections: ['matchups', 'standings', 'topPerformers', 'awards', 'outlook'],
  },
  postseasonRecap: {
    title: 'The Cob Chronicles: Postseason Report',
    sections: ['bracket', 'champion', 'allPostseason', 'finalStandings'],
  },
  seasonRecap: {
    title: 'The Cob Chronicles: Season Recap',
    sections: ['finalStandings', 'awards', 'records', 'highlights', 'outlook'],
  },
  managerProfile: {
    title: 'Manager Dossier',
    sections: ['career', 'seasonHistory', 'h2h', 'strengths', 'weaknesses'],
  },
};

export default cobChroniclesTheme;
