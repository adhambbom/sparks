# Auth Testing Playbook

## Step 1: MongoDB Verification
```
mongosh
use synthetic_sparks
db.users.find({role: "admin"}).pretty()
db.users.findOne({role: "admin"}, {password_hash: 1})
```
Verify: bcrypt hash starts with `$2b$`, indexes exist on users.email (unique), login_attempts.identifier, password_reset_tokens.expires_at (TTL).

## Step 2: API Testing
```bash
# Register
curl -c cookies.txt -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"player@test.com","password":"test123","name":"TestPlayer"}'

# Login
curl -c cookies.txt -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# Get current user
curl -b cookies.txt http://localhost:8001/api/auth/me

# Create character
curl -b cookies.txt -X POST http://localhost:8001/api/character/create \
  -H "Content-Type: application/json" \
  -d '{"name":"Spark"}'

# Get save
curl -b cookies.txt http://localhost:8001/api/game/save

# Save state
curl -b cookies.txt -X POST http://localhost:8001/api/game/save \
  -H "Content-Type: application/json" \
  -d '{"position":{"x":5,"y":5},"map":"academy"}'
```
