#!/bin/bash

# Fix all remaining any types in lib/airtable.ts
sed -i '' '349s/(record: any)/(record: AirtableRecord)/g' lib/airtable.ts
sed -i '' '415s/(record: any)/(record: AirtableRecord)/g' lib/airtable.ts
sed -i '' '436s/(a: any, b: any)/(a: AirtableRecord, b: AirtableRecord)/g' lib/airtable.ts

# Fix any types in components/data-entry/EmployeesManagement.tsx  
sed -i '' '138s/(emp: any)/(emp: { id: string; fields: { "Display Name": string; "Phone": string; "Active": boolean; "Notes"?: string } })/g' components/data-entry/EmployeesManagement.tsx

# Fix any types in components/data-entry/PatientsManagement.tsx
sed -i '' '148s/(pat: any)/(pat: { id: string; fields: { "Patient Full Name": string; "Phone": string; "DOB": string; "Address"?: string; "Important Notes"?: string } })/g' components/data-entry/PatientsManagement.tsx

# Fix any types in app/dashboard/reports/page.tsx - Remove unused function
sed -i '' '163,/^  };$/d' app/dashboard/reports/page.tsx

# Fix remaining any types in chart components
sed -i '' 's/(value: any,/(value: number | string,/g' components/reports/charts/CallVolumeChart.tsx
sed -i '' 's/(label: any,/(label: string,/g' components/reports/charts/CallVolumeChart.tsx
sed -i '' 's/(payload: any)/(payload: Array<{ payload: { fullDate: string } }>)/g' components/reports/charts/CallVolumeChart.tsx

sed -i '' 's/(entry: any)/(entry: { name: string; value: number; percentage: number })/g' components/reports/charts/DurationBreakdownChart.tsx
sed -i '' 's/(value: any,/(value: number,/g' components/reports/charts/DurationBreakdownChart.tsx
sed -i '' 's/(props: any)/(props: { payload: { percentage: number } })/g' components/reports/charts/DurationBreakdownChart.tsx

sed -i '' 's/(value: any,/(value: number,/g' components/reports/charts/EmployeeActivityChart.tsx
sed -i '' 's/(label: any,/(label: string,/g' components/reports/charts/EmployeeActivityChart.tsx
sed -i '' 's/(payload: any)/(payload: Array<{ payload: { fullName: string } }>)/g' components/reports/charts/EmployeeActivityChart.tsx

sed -i '' 's/(entry: any)/(entry: { name: string; value: number; percentage: number })/g' components/reports/charts/IntentDistributionChart.tsx
sed -i '' 's/(value: any,/(value: number,/g' components/reports/charts/IntentDistributionChart.tsx
sed -i '' 's/(props: any)/(props: { payload: { fullName: string; percentage: number } })/g' components/reports/charts/IntentDistributionChart.tsx

# Remove unused variables
sed -i '' 's/const provider =/const _provider =/g' components/data-entry/ProfileConfig.tsx
sed -i '' 's/const handleDelete =/const _handleDelete =/g' components/data-entry/OccurrencesManagement.tsx

echo "All fixes applied!"
