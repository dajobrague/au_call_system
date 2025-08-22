# Confirmation Service

## How Confirmation Phrases Are Built
Generates standardized confirmation messages for user feedback during calls.

## Phrase Types
- **Job Confirmation**: Read back job details for user verification
- **Action Confirmation**: Confirm successful action execution
- **Error Messages**: Standardized error responses with recovery options

## Template System
- Uses phrase templates from `packages/playbooks/phrases.es.yaml`
- Supports variable interpolation: `{{job_number}}`, `{{status}}`, `{{scheduled_date}}`
- Handles missing values gracefully: `{{scheduled_date|sin fecha}}`

## Confirmation Building Process
1. Select appropriate template based on context
2. Extract relevant data from job record
3. Apply value formatting (dates, names, status values)
4. Interpolate variables into template
5. Return formatted confirmation phrase

## Examples
- Job Readback: "Trabajo 12345; estado En Progreso; fecha 2024-03-15. ¿Es correcto?"
- Status Update: "Estado actualizado a Completado."
- Date Update: "Fecha programada actualizada a 2024-03-20."
- Error: "No encuentro ese trabajo. Dime el número nuevamente."

## Localization
- All phrases support Spanish (es) and English (en)
- Language selection based on LANG environment variable
- Fallback to English if translation missing

## TODO
- Implement rich formatting for complex confirmations
- Add support for dynamic phrase selection based on context
- Optimize phrase loading for performance
