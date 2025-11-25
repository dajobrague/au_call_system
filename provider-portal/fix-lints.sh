#!/bin/bash

# Fix all linting errors

# Fix unused vars by prefixing with _
sed -i '' 's/} catch (err) {/} catch (_err) {/g' app/dashboard/reports/page.tsx
sed -i '' 's/} catch (err) {/} catch (_err) {/g' components/data-entry/EmployeesManagement.tsx
sed -i '' 's/} catch (err) {/} catch (_err) {/g' components/data-entry/OccurrencesManagement.tsx
sed -i '' 's/} catch (err) {/} catch (_err) {/g' components/data-entry/PatientsManagement.tsx
sed -i '' 's/} catch (err) {/} catch (_err) {/g' components/data-entry/ProfileConfig.tsx
sed -i '' 's/} catch (err) {/} catch (_err) {/g' hooks/useReportData.ts
sed -i '' 's/} catch (error) {/} catch (_error) {/g' lib/airtable.ts

# Remove unused imports
sed -i '' 's/, useEffect//g' components/data-entry/OccurrencesManagement.tsx
sed -i '' 's/, Edit2, Trash2//g' components/data-entry/OccurrencesManagement.tsx
sed -i '' 's/, Upload//g' components/data-entry/ProfileConfig.tsx

# Fix unescaped quotes
sed -i '' 's/Click "Add Employee"/Click \&quot;Add Employee\&quot;/g' components/data-entry/EmployeesManagement.tsx
sed -i '' 's/Click "Add Patient"/Click \&quot;Add Patient\&quot;/g' components/data-entry/PatientsManagement.tsx

echo "Fixes applied"
