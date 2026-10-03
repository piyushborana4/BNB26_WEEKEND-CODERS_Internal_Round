# Fair Drop Core API

## GET /api/health

**Request body:** None

**Example request:**

```http
GET /api/health
```

**Success response: `200`**

```json
{
  "status": "ok"
}
```

**Important errors:** None defined.

## GET /api/event

**Request body:** None

**Example request:**

```http
GET /api/event
```

**Success response: `200`**

```json
{
  "id": 1,
  "name": "TechFest 2026",
  "total_seats": 500,
  "available_seats": 500,
  "status": "upcoming"
}
```

**Important errors:**

- `404` - `{ "error": "Event not found" }`
- `500` - `{ "error": "Unable to fetch event" }` or `{ "error": "Database is not ready" }`

## POST /api/join

**Request body:**

```json
{
  "name": "Alice",
  "email": "alice@example.com"
}
```

**Example request:**

```http
POST /api/join
Content-Type: application/json

{
  "name": "Alice",
  "email": "alice@example.com"
}
```

**Success response: `200`**

```json
{
  "userId": 123,
  "sessionId": "b7f5c4f4-7c6f-4ea8-8d45-9a4b3d7f6f10",
  "queuePosition": 47,
  "status": "waiting"
}
```

**Important errors:**

- `400` - `{ "error": "name and email are required" }`
- `404` - `{ "error": "No open event found" }`
- `500` - `{ "error": "Unable to join the queue" }`

## GET /api/queue/:userId

**Request body:** None

**Example request:**

```http
GET /api/queue/123
```

**Success response: `200`**

```json
{
  "userId": 123,
  "queuePosition": 47,
  "status": "WAITING"
}
```

**Important errors:**

- `404` - `{ "error": "User not found" }`
- `404` - `{ "error": "User is not in the queue" }`
- `404` - `{ "error": "No open event found" }`
- `500` - `{ "error": "Unable to fetch queue status" }`

## POST /api/queue/process-next

Processes one waiting user.

**Request body:** None

**Example request:**

```http
POST /api/queue/process-next
```

**Success response: `200`**

```json
{
  "userId": 123,
  "name": "Alice",
  "email": "alice@example.com",
  "sessionId": "b7f5c4f4-7c6f-4ea8-8d45-9a4b3d7f6f10",
  "queuePosition": 47,
  "status": "ALLOCATED",
  "bookingId": 901,
  "seatNumber": "A-047"
}
```

**Important errors:**

- `404` - `{ "error": "No waiting users" }`
- `404` - `{ "error": "No open event found" }`
- `500` - `{ "error": "Unable to process the next user" }`

## POST /api/queue/process

Processes one waiting user for testing.

**Request body:** None

**Example request:**

```http
POST /api/queue/process
```

**Success response: `200` - allocated**

```json
{
  "userId": 123,
  "name": "Alice",
  "email": "alice@example.com",
  "sessionId": "b7f5c4f4-7c6f-4ea8-8d45-9a4b3d7f6f10",
  "queuePosition": 47,
  "status": "ALLOCATED",
  "bookingId": 901,
  "seatNumber": "A-047"
}
```

**Other responses:**

- `200` - `{ "status": "NO_USERS_WAITING" }`
- `200` - A processed user with `"status": "SOLD_OUT"`
- `404` - `{ "error": "No open event found" }`
- `500` - `{ "error": "Unable to process the queue" }`

## POST /api/book/:userId

**Request body:** None

**Example request:**

```http
POST /api/book/123
```

**Success response: `200`**

```json
{
  "bookingId": 901,
  "userId": 123,
  "seatNumber": "A-047",
  "bookingStatus": "CONFIRMED"
}
```

**Important errors:**

- `400` - `{ "error": "userId must be a positive integer" }`
- `404` - `{ "error": "User not found" }`
- `404` - `{ "error": "User is not ready for booking" }`
- `404` - `{ "error": "No open event found" }`
- `409` - `{ "bookingStatus": "SOLD_OUT" }`
- `500` - `{ "error": "Unable to create booking" }`

## GET /api/booking/:userId

**Request body:** None

**Example request:**

```http
GET /api/booking/123
```

**Success response: `200`**

```json
{
  "bookingId": 901,
  "userId": 123,
  "eventName": "TechFest 2026",
  "seatNumber": "A-047",
  "bookingStatus": "CONFIRMED",
  "createdAt": "2026-10-03 17:29:24"
}
```

**Important errors:**

- `400` - `{ "error": "userId must be a positive integer" }`
- `404` - `{ "error": "Confirmed booking not found" }`
- `500` - `{ "error": "Unable to fetch booking" }` or `{ "error": "Database is not ready" }`

## GET /api/core-statistics

**Request body:** None

**Example request:**

```http
GET /api/core-statistics
```

**Success response: `200`**

```json
{
  "totalUsers": 12,
  "queueSize": 4,
  "totalSeats": 500,
  "allocatedSeats": 8,
  "availableSeats": 492,
  "totalBookings": 8
}
```

**Important errors:**

- `500` - `{ "error": "Unable to fetch core statistics" }`
