# Safe Field Rename/Add Procedure

## Overview
Procedures for safely modifying Airtable field names and adding new fields without breaking the voice agent system.

## Before Making Changes

### 1. Document Current Configuration
Record current field mappings from environment variables:
```bash
# Document current field names
echo "Current field configuration:"
echo "AIRTABLE_JOBS_TABLE=$AIRTABLE_JOBS_TABLE"
echo "AIRTABLE_JOB_NUMBER_FIELD=$AIRTABLE_JOB_NUMBER_FIELD"
echo "AIRTABLE_CLIENT_ID_FIELD=$AIRTABLE_CLIENT_ID_FIELD"
echo "AIRTABLE_STATUS_FIELD=$AIRTABLE_STATUS_FIELD"
echo "AIRTABLE_SCHEDULED_DATE_FIELD=$AIRTABLE_SCHEDULED_DATE_FIELD"
echo "AIRTABLE_ASSIGNEE_FIELD=$AIRTABLE_ASSIGNEE_FIELD"
echo "AIRTABLE_JOB_HISTORY_FIELD=$AIRTABLE_JOB_HISTORY_FIELD"
```

### 2. Test Environment Verification
- Ensure staging/development environment matches production
- Test current functionality works correctly
- Document any custom field configurations

### 3. Backup Strategy
- Export current Airtable data to CSV
- Screenshot current base structure
- Document all formula fields that reference target fields

## Field Rename Procedure

### Safe Rename Process
**Important**: Airtable field renames can break API access. Follow this process:

#### Option A: Environment Variable Update (Recommended)
1. **Keep Airtable Field Name**: Don't rename in Airtable
2. **Update Environment Variable**: Change the environment variable to match desired name
3. **Deploy Configuration**: Update application configuration
4. **Test Functionality**: Verify all operations work correctly
5. **Optional Airtable Rename**: Rename field in Airtable to match env var

#### Option B: Staged Airtable Rename
1. **Create New Field**: Add new field with desired name in Airtable
2. **Populate New Field**: Copy data from old field to new field
3. **Update Environment Variables**: Point to new field name
4. **Deploy and Test**: Verify system works with new field
5. **Remove Old Field**: Delete old field after confirming success

### Step-by-Step Example: Renaming "job_number" to "work_order_id"

#### Using Option A (Environment Variable Change):
```bash
# Current configuration
AIRTABLE_JOB_NUMBER_FIELD=job_number

# New configuration  
AIRTABLE_JOB_NUMBER_FIELD=work_order_id

# Deploy change and test
```

#### Using Option B (Staged Rename):
1. **In Airtable**: Create new field "work_order_id" (same type as job_number)
2. **Copy Data**: Use Airtable formula to copy: `{job_number}`
3. **Update Environment**:
   ```bash
   AIRTABLE_JOB_NUMBER_FIELD=work_order_id
   ```
4. **Deploy and Test**: Verify all voice agent operations work
5. **Clean Up**: Delete old "job_number" field in Airtable

## Adding New Fields

### Planning New Fields
Before adding fields, consider:
- **Field Type**: Text, Date, Select, Number, etc.
- **Required vs Optional**: Will the field always have data?
- **Default Values**: What should empty fields show?
- **Impact on Voice Agent**: How will field appear in confirmations?

### Safe Addition Process

#### 1. Add Field in Airtable
- Use descriptive field name
- Choose appropriate field type
- Set default value if needed
- Configure field properties (formatting, options)

#### 2. Update Field Configuration
Add new field constant in `apps/web/src/config/fields.ts`:
```typescript
// Add new field constant
// const NEW_FIELD = process.env.AIRTABLE_NEW_FIELD || 'new_field_name';
```

#### 3. Update Environment Variables
Add environment variable for new field:
```bash
# Add to .env files
AIRTABLE_NEW_FIELD=new_field_name
```

#### 4. Update Mappers
Modify adapters in `packages/adapters/airtable/`:

**jobMapper.md** - Add mapping logic:
```typescript
// Domain → Airtable
// newField → new_field_name

// Airtable → Domain  
// new_field_name → newField
```

#### 5. Update Domain Models
Add field to domain types in `packages/domain/src/models/`:
```typescript
// Add to JobRecord interface
// newField?: string;
```

#### 6. Update Voice Prompts (if applicable)
If field should appear in voice confirmations, update:
- `packages/playbooks/phrases.es.yaml` - Add prompt templates
- `packages/domain/src/selectors/job-confirmation.md` - Add to confirmation logic

### Example: Adding "priority" Field

#### 1. Airtable Setup
- Field Name: `priority`
- Field Type: Single Select
- Options: Low, Medium, High, Urgent
- Default: Medium

#### 2. Configuration Update
```bash
# Environment variable
AIRTABLE_PRIORITY_FIELD=priority
```

#### 3. Mapper Update
```typescript
// Domain to Airtable
priority → priority

// Airtable to Domain
priority → priority (with enum mapping)
```

#### 4. Voice Integration
```yaml
# phrases.es.yaml
confirms:
  job:
    readback: "Trabajo {{job_number}}; prioridad {{priority|normal}}; estado {{status}}..."
```

## Field Type Changes

### Changing Field Types
**Warning**: Changing field types can cause data loss or format issues.

#### Safe Type Changes
- Text → Long Text ✅
- Number → Text ✅ (with validation updates)
- Single Select → Text ✅ (options become free text)

#### Risky Type Changes
- Text → Number ❌ (invalid numbers become null)
- Long Text → Text ❌ (truncation risk)
- Date → Text ❌ (format changes)

#### Procedure for Type Changes
1. **Export Data**: Backup current field data
2. **Test in Staging**: Change type in staging environment first
3. **Update Validation**: Modify application validation rules
4. **Deploy Changes**: Update application to handle new type
5. **Change Production**: Make type change in production Airtable
6. **Verify Data**: Check for any data conversion issues

## Testing Procedures

### Pre-Deployment Testing
1. **Field Access Test**: Verify application can read/write new fields
2. **Voice Flow Test**: Complete end-to-end voice interaction
3. **Data Validation**: Confirm data types and formats work correctly
4. **Error Handling**: Test behavior with missing/invalid field data

### Post-Deployment Verification
1. **Monitor Logs**: Watch for field-related errors
2. **Test Voice Calls**: Make test calls to verify functionality  
3. **Check Data Integrity**: Verify no data corruption occurred
4. **Performance Check**: Ensure no performance degradation

## Rollback Procedures

### Environment Variable Rollback
```bash
# Revert to previous environment variable values
AIRTABLE_JOB_NUMBER_FIELD=job_number  # Previous value

# Redeploy application with old configuration
```

### Airtable Field Rollback
1. **Restore Old Field**: Re-create original field if deleted
2. **Copy Data Back**: Use formulas or manual process to restore data
3. **Update Environment**: Point back to original field names
4. **Test System**: Verify functionality restored

### Data Recovery
- **From Backups**: Restore from CSV exports
- **From History**: Use Airtable revision history if available
- **Manual Entry**: Re-enter critical data if necessary

## Common Issues and Solutions

### "Field not found" Errors
**Cause**: Environment variable doesn't match actual Airtable field name
**Solution**: Check spelling and case sensitivity in both places

### Data Type Mismatch Errors
**Cause**: Application expects different data type than Airtable provides
**Solution**: Update validation logic or change Airtable field type

### Permission Denied Errors
**Cause**: API key lacks permission to access new fields
**Solution**: Check Airtable API key permissions and base access

### Performance Issues
**Cause**: Added fields increase query payload size
**Solution**: Use field selection to only request needed fields

## Best Practices

### Naming Conventions
- Use snake_case for Airtable field names
- Use descriptive, clear names
- Avoid special characters and spaces
- Keep names under 50 characters

### Change Management
- Always test in staging environment first
- Document all changes in version control
- Notify team before making production changes
- Schedule changes during low-usage periods

### Monitoring
- Set up alerts for field-related errors
- Monitor API usage after field changes
- Track application performance impacts
- Document field usage patterns

## TODO
- Create automated field mapping validation
- Implement field change impact analysis
- Add field usage analytics and monitoring
- Create field documentation generation tools
