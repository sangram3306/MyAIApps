# ReplyMate AI Backend API Documentation

## Base URL

`http://localhost:4000`

## Global Headers

- `X-LLM-Provider`: (Optional) Specifies the LLM provider
  (e.g. `openai`, `anthropic`, `gemini`). Defaults to internal logic if absent.
- `X-LLM-Model`: (Optional) Specific model to use from the provider.
- `X-LLM-Reasoning`: (Optional) Boolean string (`true`, `false`) to toggle reasoning.

## Routes and Payloads

### POST `/api/chat/message`

**Payload (JSON Schema):**

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
  ],
  "additionalProperties": false
}
```

**Response:**

```json
{
  "success": true
}
```

### POST `/api/coach/analyze`

**Payload (JSON Schema):**

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
  ],
  "additionalProperties": false
}
```

**Response:**

```json
{
  "success": true
}
```

### POST `/api/creator/repurpose`

**Payload (JSON Schema):**

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
  ],
  "additionalProperties": false
}
```

**Response:**

```json
{
  "success": true
}
```

### POST `/api/decision/simulate`

**Payload (JSON Schema):**

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
  ],
  "additionalProperties": false
}
```

**Response:**

```json
{
  "success": true
}
```

### POST `/api/expense/create`

**Payload (JSON Schema):**

```json
{
  "type": "object",
  "properties": {
    "amount": {
      "type": "number",
      "exclusiveMinimum": 0
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
  ],
  "additionalProperties": false
}
```

**Response:**

```json
{
  "success": true
}
```

### POST `/api/expense/message`

**Payload (JSON Schema):**

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
  ],
  "additionalProperties": false
}
```

**Response:**

```json
{
  "success": true
}
```

### POST `/api/expense/intelligence`

**Payload (JSON Schema):**

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
  },
  "additionalProperties": false
}
```

**Response:**

```json
{
  "success": true
}
```

### POST `/api/learning/skill-tree`

**Payload (JSON Schema):**

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
  ],
  "additionalProperties": false
}
```

**Response:**

```json
{
  "success": true
}
```

### POST `/api/learning/roadmap`

**Payload (JSON Schema):**

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
  ],
  "additionalProperties": false
}
```

**Response:**

```json
{
  "success": true
}
```

### POST `/api/replies/generate`

**Payload (JSON Schema):**

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
  ],
  "additionalProperties": false
}
```

**Response:**

```json
{
  "success": true
}
```

### POST `/api/replies/rewrite`

**Payload (JSON Schema):**

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
  ],
  "additionalProperties": false
}
```

**Response:**

```json
{
  "success": true
}
```

### POST `/api/replies/grammar`

**Payload (JSON Schema):**

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
  ],
  "additionalProperties": false
}
```

**Response:**

```json
{
  "success": true
}
```

### POST `/api/watch/log`

**Payload (JSON Schema):**

```json
{
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "minLength": 1
    },
    "imdbId": {
      "type": "string"
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
  ],
  "additionalProperties": false
}
```

**Response:**

```json
{
  "success": true
}
```

### PATCH `/api/watch/items/{id}`

**Payload (JSON Schema):**

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
        ],
        "additionalProperties": false
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
        ],
        "additionalProperties": false
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
        ],
        "additionalProperties": false
      }
    },
    "synopsis": {
      "type": "string"
    },
    "notes": {
      "type": "string"
    }
  },
  "additionalProperties": false
}
```

**Response:**

```json
{
  "success": true
}
```

### PATCH `/api/watch/items/{id}/status`

**Payload (JSON Schema):**

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
  ],
  "additionalProperties": false
}
```

**Response:**

```json
{
  "success": true
}
```

### POST `/api/watch/search`

**Payload (JSON Schema):**

```json
{
  "type": "object",
  "properties": {
    "q": {
      "type": "string",
      "minLength": 1
    },
    "type": {
      "type": "string",
      "enum": [
        "movie",
        "series"
      ]
    }
  },
  "required": [
    "q"
  ],
  "additionalProperties": false
}
```

**Response:**

```json
{
  "success": true
}
```

### POST `/api/watch/resolve-title`

Endpoint for /api/watch/resolve-title

**Payload (JSON Schema):**

```json
{
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "minLength": 1
    },
    "year": {
      "type": "string"
    },
    "type": {
      "type": "string",
      "enum": [
        "movie",
        "series"
      ]
    },
    "director": {
      "type": "string"
    },
    "hint": {
      "type": "string"
    }
  },
  "required": [
    "title"
  ],
  "additionalProperties": false
}
```

**Response:**

```json
{
  "success": true
}
```
