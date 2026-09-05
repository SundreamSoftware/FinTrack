# Architectural decisions

## ADR 001: Static SPA without backend

**Accepted.** GitHub Pages is the required host and cannot execute application APIs. All required calculations and persistence fit browser APIs. React and HashRouter provide a multi-view application without rewrite rules. No backend, cloud datastore, serverless function, account system or AI dependency is introduced. Device synchronization and automatic bank connections are consequently outside this release.

## ADR 002: IndexedDB behind a repository

**Accepted.** Transaction histories need structured storage, indexes and multi-collection atomic writes. IndexedDB provides these locally; localStorage does not. Dexie reduces transaction and migration boilerplate. A small repository contract isolates the domain and centralizes atomic application operations. React state holds forms and filters only. We do not add Redux, TanStack Query, service locators, event sourcing or an abstraction hierarchy.

## ADR 003: Deterministic classification and forecasting

**Accepted.** Explicit rules, merchant aliases and manual history are inspectable and testable, require no credential and never upload bank data. Subscription scores and savings scenarios use documented arithmetic. An LLM would add privacy exposure, cost and nondeterminism without solving a necessary requirement.

## ADR 004: Integer minor units and separate currencies

**Accepted.** Decimal CSV values are converted using strings and BigInt into safe integer minor units. Addition is checked for overflow. Intl supplies currency precision and display formatting. Forecast averages and interval conversions round explicitly back to minor units. We do not invent exchange rates or combine balances in different currencies.

## ADR 005: Native CSS and local assets

**Accepted.** The interface needs standard forms, tables, dialogs and charts. Semantic HTML plus shared CSS provides these without a UI framework or Tailwind build layer. Lucide supplies bundled icons and Recharts supplies actual data visualizations. Large report/import/forecast/settings routes and chart code are loaded separately. No remote fonts, marketing assets or tracking dependencies are required.
