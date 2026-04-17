# Client Assignment System

## Overview
The client assignment system allows administrators to assign clients to therapists for personalized mental health support.

## Features Implemented

### Backend API (`/api/admin/*`)
All endpoints require authentication token in the Authorization header.

#### 1. Get All Clients
- **GET** `/api/admin/clients`
- Returns list of all registered clients with intake form counts
- Response includes assigned therapist counts per client

#### 2. Get All Therapists
- **GET** `/api/admin/therapists`
- Returns list of approved therapists
- Shows how many clients each therapist has

#### 3. Get Active Assignments
- **GET** `/api/admin/assignments`
- Returns all active client-therapist pairs
- Includes client info, therapist info, specialties, and assignment date

#### 4. Assign Client to Therapist
- **POST** `/api/admin/assign`
- Body: `{ clientId: number, therapistId: number }`
- Creates new assignment or reactivates inactive one
- Validates both client and therapist exist

#### 5. Unassign Client from Therapist
- **DELETE** `/api/admin/assign/:assignmentId`
- Marks assignment as inactive (preserves history)
- Does not delete the record from database

#### 6. Get Client's Assignments
- **GET** `/api/admin/clients/:clientId/assignments`
- Returns all assignments (active and inactive) for a specific client

### Frontend Page (`/admin/client-assignment`)

#### Features:
- **Dashboard Stats**: Shows total clients, active therapists, and active assignments
- **Assignment Table**: Lists all current client-therapist pairs with:
  - Client name and email
  - Therapist name and email
  - Therapist specialties
  - Assignment date
  - Unassign button
- **Assignment Modal**: Click "+ Assign Client to Therapist" to:
  - Select a client from dropdown (shows current therapist count)
  - Select a therapist from dropdown (shows current client count and specialties)
  - Confirm assignment

#### Access:
Navigate to: `http://localhost:3006/admin/client-assignment`

**Note**: Currently uses the same authentication as therapist login. In production, you should add proper admin role checking.

## Database Schema

```sql
CREATE TABLE therapist_clients (
  id SERIAL PRIMARY KEY,
  therapist_id INTEGER REFERENCES therapists(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'active',
  UNIQUE(therapist_id, client_id)
);
```

## How to Use

### 1. Access Admin Panel
- Visit `http://localhost:3006/admin/client-assignment`
- Login with therapist credentials (temporary - will be admin-only in production)

### 2. View Current Assignments
- See all active client-therapist pairs in the main table
- Check assignment dates and therapist specialties

### 3. Create New Assignment
1. Click "+ Assign Client to Therapist"
2. Select a client from the dropdown
3. Select a therapist from the dropdown
4. Click "Assign" button
5. Success message will appear and table will refresh

### 4. Remove Assignment
1. Find the assignment in the table
2. Click "Unassign" button
3. Confirm in the popup dialog
4. Assignment will be marked as inactive

## Testing with Sample Data

The system already has one test assignment:
- Client: User ID 1
- Therapist: asma.taranum@outlook.com

### Add More Test Data (Optional):

```sql
-- Add more test assignments
INSERT INTO therapist_clients (therapist_id, client_id, status)
VALUES 
  (1, 2, 'active'),  -- Assuming therapist ID 1 and client ID 2 exist
  (1, 3, 'active');
```

## Future Enhancements

1. **Admin Authentication**: Add dedicated admin users and role-based access control
2. **Notifications**: Email notifications when clients are assigned
3. **Assignment History**: View full history of assignments including inactive ones
4. **Bulk Assignment**: Assign multiple clients at once
5. **Auto-Assignment**: Smart matching based on therapist specialties and client needs
6. **Therapist Capacity**: Set maximum clients per therapist
7. **Assignment Notes**: Add notes/reasons for assignments
8. **Client Preferences**: Allow clients to request specific therapists

## Security Notes

⚠️ **Important**: 
- Currently uses therapist authentication for admin panel
- Before deployment, implement proper admin role checking
- Add rate limiting for admin endpoints
- Add audit logging for assignment changes
- Validate user permissions on every request

## API Testing

Test the admin API with curl:

```bash
# Login as therapist/admin to get token
TOKEN="your_jwt_token_here"

# Get all clients
curl -H "Authorization: Bearer $TOKEN" http://localhost:5001/api/admin/clients

# Get all therapists
curl -H "Authorization: Bearer $TOKEN" http://localhost:5001/api/admin/therapists

# Get active assignments
curl -H "Authorization: Bearer $TOKEN" http://localhost:5001/api/admin/assignments

# Assign client to therapist
curl -X POST http://localhost:5001/api/admin/assign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"clientId": 1, "therapistId": 1}'

# Unassign (mark inactive)
curl -X DELETE http://localhost:5001/api/admin/assign/1 \
  -H "Authorization: Bearer $TOKEN"
```

## Deployment Considerations

When deploying to production:

1. **Database**: Ensure `therapist_clients` table is created
2. **Environment Variables**: Set proper JWT_SECRET
3. **CORS**: Configure allowed origins for frontend
4. **Admin Users**: Create dedicated admin accounts
5. **Rate Limiting**: Configure appropriate limits for admin endpoints
6. **Monitoring**: Set up logging and monitoring for assignment operations
