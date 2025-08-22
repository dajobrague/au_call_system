# How Prompts Are Organized & Referenced

## Prompt Organization
Voice prompts are organized in hierarchical YAML files within the `packages/playbooks/` directory.

## File Structure
- `phrases.es.yaml` - Spanish prompts (primary language)
- `phrases.en.yaml` - English prompts (fallback language)
- Future: Additional language files as needed

## Hierarchical Key Structure
```yaml
prompts:
  collect_client_id:
    ask: "Dime tu identificador de cliente."
    retry: "No entendí. Repite tu identificador de cliente."
    timeout: "No recibí respuesta. ¿Puedes decir tu identificador?"
  
  collect_job_number:
    ask: "Ahora dime el número de trabajo."
    retry: "Número de trabajo no válido. Inténtalo de nuevo."
    
confirms:
  job:
    readback: "Trabajo {{job_number}}; estado {{status}}; fecha {{scheduled_date|sin fecha}}. ¿Es correcto?"
  
  update:
    status: "Estado actualizado a {{value}}."
    scheduled_date: "Fecha programada actualizada a {{value}}."
    assignee: "Asignado a {{value}}."
```

## Reference Pattern
Prompts are referenced using dot notation keys:
- `prompts.collect_client_id.ask`
- `confirms.job.readback`
- `errors.not_found.job`

## Variable Interpolation
Prompts support variable substitution:
- `{{job_number}}` - Simple variable replacement
- `{{scheduled_date|sin fecha}}` - Variable with fallback value
- `{{status|title}}` - Variable with formatting filter

## Language Selection
- Primary language determined by `LANG` environment variable
- Fallback to English if translation missing
- Per-call language override possible via Twilio metadata

## Loading Strategy
- Prompts loaded at application startup
- Cached in memory for performance
- Hot reload in development mode
- Validation of key completeness across languages

## Prompt Categories
- **Collection**: Ask for user input
- **Confirmation**: Read back information for verification
- **Success**: Confirm successful actions
- **Error**: Handle various error scenarios
- **Navigation**: Guide users through conversation flow

## TODO
- Implement prompt variation for natural conversation
- Add SSML markup support for enhanced speech
- Create prompt testing and validation tools
