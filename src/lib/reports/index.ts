// Reports module exports
export { cobChroniclesTheme, reportStyles, signaturePhrases, reportTypes } from './theme';
export { generateHtmlDocument, html, reportStylesheet, renderMarkdown } from './html-generator';
export { generateWeeklyReport } from './weekly-report';
export type { WeeklyReportData, MatchupData, StandingsEntry, WeeklyScore, ReportSections, ReportOptions } from './weekly-report';
export { generatePostseasonReport } from './postseason-report';
export type { PostseasonReportData, PostseasonMatchup, PostseasonSummary, Seeding, BracketRound } from './postseason-report';
