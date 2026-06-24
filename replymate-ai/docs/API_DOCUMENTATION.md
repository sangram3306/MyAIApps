# ReplyMate AI Backend API Documentation

## Base URL

`http://localhost:4000`

## Global Headers

- `X-LLM-Provider`: (Optional) Specifies the LLM provider (e.g. `openai`, `anthropic`, `gemini`). Defaults to internal logic if absent.
- `X-LLM-Model`: (Optional) Specific model to use from the provider.
- `X-LLM-Reasoning`: (Optional) Boolean string (`true`, `false`) to toggle reasoning.

## Routes and Payloads

### POST `/api/chat/message`

**Payload (JSON):**

```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000
    }
  },
  "required": [
    "message"
  ]
}
```

**Response:**

```json
{
  "success": "true (or structured response)"
}
```

### POST `/api/coach/analyze`

**Payload (JSON):**

```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000
    },
    "relationshipContext": {
      "type": "string",
      "enum": [
        "Friend",
        "Wife",
        "Boss",
        "Client",
        "Customer",
        "Parent",
        "Sibling",
        "Other"
      ]
    }
  },
  "required": [
    "message",
    "relationshipContext"
  ]
}
```

**Response:**

```json
{
  "success": "true (or structured response)"
}
```

### POST `/api/creator/repurpose`

**Payload (JSON):**

```json
{
  "type": "object",
  "properties": {
    "sourceText": {
      "type": "string",
      "minLength": 1,
      "maxLength": 8000
    },
    "sourceType": {
      "type": "string",
      "enum": [
        "idea",
        "note",
        "article",
        "thread",
        "meeting",
        "video",
        "other"
      ],
      "default": "note"
    },
    "audience": {
      "type": "string",
      "maxLength": 120,
      "default": "general"
    },
    "goal": {
      "type": "string",
      "maxLength": 160,
      "default": "repurpose"
    },
    "tone": {
      "type": "string",
      "maxLength": 80,
      "default": "balanced"
    },
    "platforms": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "x",
          "linkedin",
          "instagram",
          "email",
          "thread"
        ]
      },
      "default": [
        "x",
        "linkedin",
        "instagram",
        "email"
      ]
    }
  },
  "required": [
    "sourceText"
  ]
}
```

**Response:**

```json
{
  "success": "true (or structured response)"
}
```

### POST `/api/decisions/simulate`

**Payload (JSON):**

```json
{
  "type": "object",
  "properties": {
    "question": {
      "type": "string",
      "minLength": 5,
      "maxLength": 500
    },
    "context": {
      "type": "string",
      "maxLength": 2000,
      "default": ""
    },
    "options": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 160
      },
      "maxItems": 6,
      "default": []
    },
    "horizon": {
      "type": "string",
      "maxLength": 120,
      "default": "near-term"
    },
    "stakes": {
      "type": "string",
      "enum": [
        "low",
        "medium",
        "high"
      ],
      "default": "medium"
    }
  },
  "required": [
    "question"
  ]
}
```

**Response:**

```json
{
  "success": "true (or structured response)"
}
```

### POST `/api/expenses/create`

**Payload (JSON):**

```json
{
  "type": "object",
  "properties": {
    "amount": {
      "type": "number",
      "minimum": 0,
      "exclusiveMinimum": true
    },
    "currency": {
      "type": "string",
      "enum": [
        "AED",
        "INR"
      ],
      "default": "AED"
    },
    "category": {
      "type": "string",
      "minLength": 1,
      "maxLength": 80
    },
    "description": {
      "type": "string",
      "maxLength": 160
    },
    "date": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    }
  },
  "required": [
    "amount",
    "category"
  ]
}
```

**Response:**

```json
{
  "success": "true (or structured response)"
}
```

### POST `/api/expenses/message`

**Payload (JSON):**

```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000
    }
  },
  "required": [
    "message"
  ]
}
```

**Response:**

```json
{
  "success": "true (or structured response)"
}
```

### POST `/api/expenses/intelligence`

**Payload (JSON):**

```json
{
  "type": "object",
  "properties": {
    "period": {
      "type": "string",
      "enum": [
        "all",
        "month",
        "year"
      ],
      "default": "month"
    }
  }
}
```

**Response:**

```json
{
  "success": "true (or structured response)"
}
```

### POST `/api/learning/skill-tree`

**Payload (JSON):**

```json
{
  "type": "object",
  "properties": {
    "skillName": {
      "type": "string",
      "minLength": 2,
      "maxLength": 160
    },
    "currentLevel": {
      "type": "string",
      "maxLength": 120,
      "default": "beginner"
    },
    "targetLevel": {
      "type": "string",
      "maxLength": 120,
      "default": "confident"
    },
    "timeBudget": {
      "type": "string",
      "maxLength": 120,
      "default": "3 hours/week"
    },
    "focusAreas": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 120
      },
      "maxItems": 8,
      "default": []
    }
  },
  "required": [
    "skillName"
  ]
}
```

**Response:**

```json
{
  "success": "true (or structured response)"
}
```

### POST `/api/learning/roadmap`

**Payload (JSON):**

```json
{
  "type": "object",
  "properties": {
    "topic": {
      "type": "string",
      "minLength": 2,
      "maxLength": 160
    },
    "goal": {
      "type": "string",
      "maxLength": 300,
      "default": "learn the fundamentals"
    },
    "currentLevel": {
      "type": "string",
      "maxLength": 120,
      "default": "beginner"
    },
    "timeline": {
      "type": "string",
      "maxLength": 120,
      "default": "8 weeks"
    },
    "timePerWeek": {
      "type": "string",
      "maxLength": 120,
      "default": "3 hours/week"
    }
  },
  "required": [
    "topic"
  ]
}
```

**Response:**

```json
{
  "success": "true (or structured response)"
}
```

### POST `/api/replies/generate`

**Payload (JSON):**

```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000
    },
    "note": {
      "type": "string",
      "maxLength": 800,
      "default": ""
    },
    "tone": {
      "type": "string",
      "nullable": true,
      "enum": [
        "none",
        "clearer",
        "shorter",
        "polite",
        "professional",
        "friendly",
        "casual",
        "funny",
        "snarky",
        "confident",
        "apologetic",
        "romantic",
        "sarcastic",
        "excited",
        "calm",
        "formal",
        "persuasive",
        "simple_english",
        "hinglish",
        "hindi",
        "more_human",
        "short",
        "short_sweet",
        "detailed"
      ],
      "default": "none"
    },
    "role": {
      "type": "string",
      "nullable": true,
      "enum": [
        "none",
        "friend",
        "best_friend",
        "partner",
        "customer_support",
        "manager",
        "professional_writer",
        "sales_expert",
        "marketing_expert",
        "influencer",
        "startup_founder",
        "comedian",
        "savage_friend",
        "poet",
        "teacher",
        "pirate",
        "five_year_old",
        "doctor",
        "ai_engineer",
        "thief",
        "cowboy",
        "astronaut",
        "shakespeare",
        "grandma",
        "lawyer",
        "gym_coach",
        "detective"
      ],
      "default": "none"
    },
    "responseCount": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5,
      "default": 5
    }
  },
  "required": [
    "message"
  ]
}
```

**Response:**

```json
{
  "success": "true (or structured response)"
}
```

### POST `/api/replies/rewrite`

**Payload (JSON):**

```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000
    },
    "note": {
      "type": "string",
      "maxLength": 800,
      "default": ""
    },
    "tone": {
      "type": "string",
      "nullable": true,
      "enum": [
        "none",
        "clearer",
        "shorter",
        "polite",
        "professional",
        "friendly",
        "casual",
        "funny",
        "snarky",
        "confident",
        "apologetic",
        "romantic",
        "sarcastic",
        "excited",
        "calm",
        "formal",
        "persuasive",
        "simple_english",
        "hinglish",
        "hindi",
        "more_human",
        "short",
        "short_sweet",
        "detailed"
      ],
      "default": "none"
    },
    "role": {
      "type": "string",
      "nullable": true,
      "enum": [
        "none",
        "friend",
        "best_friend",
        "partner",
        "customer_support",
        "manager",
        "professional_writer",
        "sales_expert",
        "marketing_expert",
        "influencer",
        "startup_founder",
        "comedian",
        "savage_friend",
        "poet",
        "teacher",
        "pirate",
        "five_year_old",
        "doctor",
        "ai_engineer",
        "thief",
        "cowboy",
        "astronaut",
        "shakespeare",
        "grandma",
        "lawyer",
        "gym_coach",
        "detective"
      ],
      "default": "none"
    },
    "responseCount": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5,
      "default": 5
    }
  },
  "required": [
    "message"
  ]
}
```

**Response:**

```json
{
  "success": "true (or structured response)"
}
```

### POST `/api/replies/grammar`

**Payload (JSON):**

```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000
    },
    "note": {
      "type": "string",
      "maxLength": 800,
      "default": ""
    },
    "tone": {
      "type": "string",
      "nullable": true,
      "enum": [
        "none",
        "clearer",
        "shorter",
        "polite",
        "professional",
        "friendly",
        "casual",
        "funny",
        "snarky",
        "confident",
        "apologetic",
        "romantic",
        "sarcastic",
        "excited",
        "calm",
        "formal",
        "persuasive",
        "simple_english",
        "hinglish",
        "hindi",
        "more_human",
        "short",
        "short_sweet",
        "detailed"
      ],
      "default": "none"
    },
    "role": {
      "type": "string",
      "nullable": true,
      "enum": [
        "none",
        "friend",
        "best_friend",
        "partner",
        "customer_support",
        "manager",
        "professional_writer",
        "sales_expert",
        "marketing_expert",
        "influencer",
        "startup_founder",
        "comedian",
        "savage_friend",
        "poet",
        "teacher",
        "pirate",
        "five_year_old",
        "doctor",
        "ai_engineer",
        "thief",
        "cowboy",
        "astronaut",
        "shakespeare",
        "grandma",
        "lawyer",
        "gym_coach",
        "detective"
      ],
      "default": "none"
    },
    "responseCount": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5,
      "default": 5
    }
  },
  "required": [
    "message"
  ]
}
```

**Response:**

```json
{
  "success": "true (or structured response)"
}
```

### POST `/api/watch/log`

**Payload (JSON):**

```json
{
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "minLength": 1
    },
    "type": {
      "type": "string",
      "enum": [
        "movie",
        "series"
      ]
    },
    "status": {
      "type": "string",
      "enum": [
        "planned",
        "started",
        "in_progress",
        "completed",
        "dropped"
      ],
      "default": "planned"
    },
    "favorite": {
      "type": "boolean",
      "default": false
    },
    "notes": {
      "type": "string",
      "default": ""
    }
  },
  "required": [
    "title"
  ]
}
```

**Response:**

```json
{
  "success": "true (or structured response)"
}
```

### PATCH `/api/watch/items/{id}`

**Payload (JSON):**

```json
{
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "minLength": 1
    },
    "type": {
      "type": "string",
      "enum": [
        "movie",
        "series"
      ]
    },
    "status": {
      "type": "string",
      "enum": [
        "planned",
        "started",
        "in_progress",
        "completed",
        "dropped"
      ]
    },
    "favorite": {
      "type": "boolean"
    },
    "releaseYear": {
      "type": "string"
    },
    "director": {
      "type": "string"
    },
    "leadActors": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "budget": {
      "type": "string"
    },
    "boxOffice": {
      "type": "string"
    },
    "posterUrl": {
      "type": "string"
    },
    "ratings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "source": {
            "type": "string",
            "minLength": 1
          },
          "value": {
            "type": "string",
            "default": "Unknown"
          }
        },
        "required": [
          "source"
        ]
      }
    },
    "availability": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "provider": {
            "type": "string",
            "minLength": 1
          },
          "region": {
            "type": "string",
            "minLength": 2
          },
          "type": {
            "type": "string",
            "enum": [
              "stream",
              "rent",
              "buy",
              "free",
              "ads"
            ],
            "default": "stream"
          },
          "link": {
            "type": "string"
          }
        },
        "required": [
          "provider",
          "region"
        ]
      }
    },
    "externalDetails": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "label": {
            "type": "string",
            "minLength": 1
          },
          "value": {
            "type": "string",
            "minLength": 1
          }
        },
        "required": [
          "label",
          "value"
        ]
      }
    },
    "synopsis": {
      "type": "string"
    },
    "notes": {
      "type": "string"
    }
  }
}
```

**Response:**

```json
{
  "success": "true (or structured response)"
}
```

### PATCH `/api/watch/items/{id}/status`

**Payload (JSON):**

```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "enum": [
        "planned",
        "started",
        "in_progress",
        "completed",
        "dropped"
      ]
    }
  },
  "required": [
    "status"
  ]
}
```

**Response:**

```json
{
  "success": "true (or structured response)"
}
```

### POST `/api/watch/search`

**Payload (JSON):**

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string"
    },
    "limit": {
      "type": "number"
    }
  },
  "required": [
    "query"
  ]
}
```

**Response:**

```json
{
  "success": "true (or structured response)"
}
```

## Additional Endpoints

### POST `/api/auth/register`

**Description:** Registers a new user

**Payload (JSON):**
```json
{
  "type": "object",
  "properties": {
    "email": {
      "type": "string"
    },
    "password": {
      "type": "string"
    }
  },
  "required": [
    "email",
    "password"
  ]
}
```

**Response:**
```json
{
  "success": true
}
```

### POST `/api/auth/login`

**Description:** Logs in an existing user

**Payload (JSON):**
```json
{
  "type": "object",
  "properties": {
    "email": {
      "type": "string"
    },
    "password": {
      "type": "string"
    }
  },
  "required": [
    "email",
    "password"
  ]
}
```

**Response:**
```json
{
  "success": true
}
```

### GET `/api/auth/me`

**Description:** Gets the current user's profile

**Response:**
```json
{
  "success": true
}
```

### PUT `/api/auth/me/profile-image`

**Description:** Updates user profile image

**Payload (JSON):**
```json
{
  "type": "object",
  "properties": {
    "base64": {
      "type": "string"
    }
  },
  "required": [
    "base64"
  ]
}
```

**Response:**
```json
{
  "success": true
}
```

### DELETE `/api/auth/me`

**Description:** Deletes the current user

**Response:**
```json
{
  "success": true
}
```

### PUT `/api/auth/me/profile`

**Description:** Updates user profile

**Payload (JSON):**
```json
{}
```

**Response:**
```json
{
  "success": true
}
```

### PUT `/api/auth/me/password`

**Description:** Updates user password

**Payload (JSON):**
```json
{
  "type": "object",
  "properties": {
    "newPassword": {
      "type": "string"
    }
  },
  "required": [
    "newPassword"
  ]
}
```

**Response:**
```json
{
  "success": true
}
```

### POST `/api/auth/unsubscribe`

**Description:** Unsubscribes a user

**Payload (JSON):**
```json
{}
```

**Response:**
```json
{
  "success": true
}
```

### POST `/api/auth/subscribe-coupon`

**Description:** Subscribes a user with a coupon

**Payload (JSON):**
```json
{
  "type": "object",
  "properties": {
    "coupon": {
      "type": "string"
    }
  },
  "required": [
    "coupon"
  ]
}
```

**Response:**
```json
{
  "success": true
}
```

### POST `/api/cinetrack/chat`

**Description:** Chats with CineTrack AI

**Payload (JSON):**
```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string"
    }
  },
  "required": [
    "message"
  ]
}
```

**Response:**
```json
{
  "success": true
}
```

### GET `/api/creator/drafts`

**Description:** Gets repurposed content drafts

**Response:**
```json
{
  "success": true
}
```

### POST `/api/creator/drafts/update`

**Description:** Updates a content draft

**Payload (JSON):**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "content": {
      "type": "string"
    }
  },
  "required": [
    "id"
  ]
}
```

**Response:**
```json
{
  "success": true
}
```

### GET `/api/expenses/export`

**Description:** Exports expenses

**Response:**
```json
{
  "success": true
}
```

### POST `/api/expenses/clear`

**Description:** Clears expenses

**Payload (JSON):**
```json
{}
```

**Response:**
```json
{
  "success": true
}
```

### GET `/api/learning/skill-trees`

**Description:** Lists saved skill trees

**Response:**
```json
{
  "success": true
}
```

### POST `/api/learning/skill-trees/save`

**Description:** Saves a skill tree

**Payload (JSON):**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "topic": {
      "type": "string"
    },
    "data": {
      "type": "object"
    }
  },
  "required": [
    "topic"
  ]
}
```

**Response:**
```json
{
  "success": true
}
```

### DELETE `/api/learning/skill-trees/{id}`

**Description:** Deletes a skill tree

**Response:**
```json
{
  "success": true
}
```

### GET `/api/learning/roadmaps`

**Description:** Lists saved roadmaps

**Response:**
```json
{
  "success": true
}
```

### POST `/api/learning/roadmaps/save`

**Description:** Saves a roadmap

**Payload (JSON):**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "topic": {
      "type": "string"
    },
    "data": {
      "type": "object"
    }
  },
  "required": [
    "topic"
  ]
}
```

**Response:**
```json
{
  "success": true
}
```

### DELETE `/api/learning/roadmaps/{id}`

**Description:** Deletes a roadmap

**Response:**
```json
{
  "success": true
}
```

### GET `/api/settings/llm-options`

**Description:** Gets available LLM options

**Response:**
```json
{
  "success": true
}
```

### GET `/api/settings/deepseek-balance`

**Description:** Gets DeepSeek balance

**Response:**
```json
{
  "success": true
}
```

### GET `/api/settings/deepseek-usage`

**Description:** Gets DeepSeek usage

**Response:**
```json
{
  "success": true
}
```

### GET `/api/settings/usage`

**Description:** Gets overall usage

**Response:**
```json
{
  "success": true
}
```

### GET `/api/watch/items`

**Description:** Lists watch items

**Response:**
```json
{
  "success": true
}
```

### GET `/api/watch/profile`

**Description:** Gets the watcher profile

**Response:**
```json
{
  "success": true
}
```

### DELETE `/api/watch/items/{id}`

**Description:** Deletes a watch item

**Response:**
```json
{
  "success": true
}
```

### POST `/api/watch/embed-all`

**Description:** Embeds all watch items

**Payload (JSON):**
```json
{}
```

**Response:**
```json
{
  "success": true
}
```
