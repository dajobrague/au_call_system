# Client Record Mapping

## Domain to Airtable Client Mapping

### Core Client Fields
```typescript
Domain Field          → Airtable Field
─────────────────────   ──────────────────────
id                    → (record ID, not a field)
clientId             → client_unique_id
clientName           → client_name
active               → active
contactEmail         → contact_email
contactPhone         → contact_phone
createdDate          → created_date
lastActivity         → last_activity_date
```

### Client Status Mapping
```typescript
Domain Status         → Airtable Value
─────────────────────   ──────────────────
ACTIVE               → true (boolean)
INACTIVE             → false (boolean)
SUSPENDED            → "Suspended" (select)
TERMINATED           → "Terminated" (select)
```

## Client Lookup Operations

### Find by Client ID
```typescript
// Input
{
  clientId: "ABC123"
}

// Airtable Query
{
  filterByFormula: "{client_unique_id} = 'ABC123'",
  maxRecords: 1,
  fields: ['client_unique_id', 'client_name', 'active']
}

// Domain Result
{
  id: "recClientABC123",
  clientId: "ABC123", 
  clientName: "Acme Corporation",
  active: true,
  createdDate: new Date("2024-01-15T00:00:00.000Z")
}
```

### Client Validation
```typescript
// Check if client exists and is active
const validation = await validateClient("ABC123");

// Success response
{
  isValid: true,
  client: { /* ClientRecord */ },
  reason: null
}

// Failure responses
{
  isValid: false,
  client: null,
  reason: "CLIENT_NOT_FOUND"
}

{
  isValid: false,
  client: { /* ClientRecord with active: false */ },
  reason: "CLIENT_INACTIVE"
}
```

## Client Statistics Integration

### Job Count Calculations
```typescript
// Get client with job statistics
const clientWithStats = await getClientWithJobStats("ABC123");

// Result includes calculated fields
{
  ...clientRecord,
  totalJobs: 45,
  activeJobs: 3,
  completedJobs: 40,
  cancelledJobs: 2,
  lastJobDate: new Date("2024-03-10T00:00:00.000Z")
}
```

### Statistics Query Strategy
```typescript
// Option 1: Linked records (if configured in Airtable)
{
  fields: ['client_name', 'active', 'linked_jobs'],
  expand: ['linked_jobs']
}

// Option 2: Separate job table query
{
  table: 'Jobs',
  filterByFormula: "{client_unique_id} = 'ABC123'",
  fields: ['status', 'created_date']
}
```

## Client Field Configuration

### Environment Variable Mapping
```typescript
const CLIENT_FIELD_MAPPING = {
  table: process.env.AIRTABLE_CLIENTS_TABLE || 'Clients',
  clientId: process.env.AIRTABLE_CLIENT_ID_FIELD || 'client_unique_id',
  clientName: process.env.AIRTABLE_CLIENT_NAME_FIELD || 'client_name',
  active: process.env.AIRTABLE_CLIENT_ACTIVE_FIELD || 'active',
  contactEmail: process.env.AIRTABLE_CLIENT_EMAIL_FIELD || 'contact_email',
  contactPhone: process.env.AIRTABLE_CLIENT_PHONE_FIELD || 'contact_phone'
};
```

### Custom Field Support
```typescript
// Additional fields can be mapped based on client needs
const EXTENDED_CLIENT_FIELDS = {
  industry: 'industry_type',
  region: 'service_region', 
  priority: 'client_priority',
  billingAddress: 'billing_address',
  serviceLevel: 'service_level_agreement'
};
```

## Client Access Control

### Permission Mapping
```typescript
// Client permissions based on status and type
const getClientPermissions = (client: ClientRecord): ClientPermissions => {
  return {
    canCreateJobs: client.active && client.status !== 'SUSPENDED',
    canUpdateJobs: client.active,
    canViewHistory: true, // Always allowed for valid clients
    maxActiveJobs: client.serviceLevel === 'PREMIUM' ? 50 : 10
  };
};
```

### Client Hierarchy Support
```typescript
// If client has parent/child relationships
{
  clientId: "ABC123",
  parentClientId: "ABC000", // Parent organization
  childClientIds: ["ABC124", "ABC125"], // Sub-organizations
  billingClientId: "ABC000" // Who gets billed
}
```

## Error Handling

### Client Not Found
```typescript
{
  error: "CLIENT_NOT_FOUND",
  message: "Client 'ABC123' does not exist",
  code: 404,
  retryable: false
}
```

### Client Inactive
```typescript
{
  error: "CLIENT_INACTIVE", 
  message: "Client 'ABC123' is not active",
  code: 403,
  retryable: false,
  details: {
    status: "SUSPENDED",
    reason: "Account suspended due to payment issues"
  }
}
```

### Multiple Clients Found
```typescript
{
  error: "MULTIPLE_CLIENTS_FOUND",
  message: "Multiple clients found with ID 'ABC123'",
  code: 409,
  retryable: false,
  details: {
    count: 2,
    suggestion: "Contact support to resolve duplicate client IDs"
  }
}
```

## Performance Considerations

### Client Caching
```typescript
// Cache frequently accessed client data
const clientCache = new Map<string, ClientRecord>();

// Cache TTL: 15 minutes for client data
const CACHE_TTL = 15 * 60 * 1000;

// Invalidate cache on client updates
const invalidateClientCache = (clientId: string) => {
  clientCache.delete(clientId);
};
```

### Batch Client Lookups
```typescript
// Optimize multiple client lookups
const batchGetClients = async (clientIds: string[]): Promise<ClientRecord[]> => {
  const formula = `OR(${clientIds.map(id => `{client_unique_id} = '${id}'`).join(', ')})`;
  return await queryClients({ filterByFormula: formula });
};
```

## Integration Points

### CRM System Sync
```typescript
// Sync client data with external CRM
interface CRMClientSync {
  airtableId: string;
  crmId: string;
  lastSyncDate: Date;
  syncStatus: 'SUCCESS' | 'PENDING' | 'FAILED';
}
```

### Billing System Integration
```typescript
// Link to external billing system
interface BillingIntegration {
  clientId: string;
  billingSystemId: string;
  paymentStatus: 'CURRENT' | 'OVERDUE' | 'SUSPENDED';
  lastPaymentDate: Date;
}
```

## TODO
- Implement client data synchronization with external systems
- Add client contact management for multiple contacts per client
- Create client onboarding workflow integration
