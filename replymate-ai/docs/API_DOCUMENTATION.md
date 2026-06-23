# ReplyMate AI API Documentation

This document accurately reflects the current request payloads, headers, and response structures based on the latest routes and Zod schemas.

## Global Headers

Many endpoints support the following optional headers for LLM provider and model overrides:
- `X-LLM-Provider`: String
- `X-LLM-Model`: String
- `X-LLM-Reasoning`: String

### POST `/api/chat/message`
**Chat with generic agent**

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

### POST `/api/cinetrack/chat`
**Chat with Cinetrack agent**

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

### GET `/api/creator/drafts`
**Get creator drafts**

**Response:**
```json
{
  "success": "true (or structured response)"
}
```

### POST `/api/creator/drafts/update`
**Update creator draft**

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
    },
    "title": {
      "type": "string"
    },
    "platforms": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "published": {
      "type": "boolean"
    },
    "scheduledFor": {
      "type": "string"
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "metrics": {
      "type": "object"
    }
  },
  "required": [
    "id",
    "content"
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
**Simulate a decision**

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

### POST `/api/expenses/clear`
**Clear expenses**

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

### GET `/api/expenses/export`
**Export expenses**

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

### GET `/api/learning/roadmaps`
**Get learning roadmaps**

**Response:**
```json
{
  "success": "true (or structured response)"
}
```

### POST `/api/learning/roadmaps/save`
**Save learning roadmap**

**Payload (JSON):**
```json
{
  "type": "object",
  "properties": {
    "topic": {
      "type": "string",
      "minLength": 1
    },
    "goal": {
      "type": "string",
      "default": "learn the fundamentals"
    },
    "currentLevel": {
      "type": "string",
      "default": "beginner"
    },
    "timeline": {
      "type": "string",
      "default": "8 weeks"
    },
    "timePerWeek": {
      "type": "string",
      "default": "3 hours/week"
    },
    "overview": {
      "type": "string",
      "default": ""
    },
    "phases": {
      "type": "array",
      "items": {
        "type": "object"
      },
      "default": []
    },
    "weeklyPlan": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "default": []
    },
    "practiceLoop": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "default": []
    },
    "pitfalls": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "default": []
    },
    "resources": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "default": []
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

### DELETE `/api/learning/roadmaps/{id}`
**Delete learning roadmap**

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

### GET `/api/learning/skill-trees`
**Get skill trees**

**Response:**
```json
{
  "success": "true (or structured response)"
}
```

### POST `/api/learning/skill-trees/save`
**Save skill tree**

**Payload (JSON):**
```json
{
  "type": "object",
  "properties": {
    "skillName": {
      "type": "string",
      "minLength": 1
    },
    "currentLevel": {
      "type": "string",
      "default": "beginner"
    },
    "targetLevel": {
      "type": "string",
      "default": "confident"
    },
    "timeBudget": {
      "type": "string",
      "default": "3 hours/week"
    },
    "focusAreas": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "default": []
    },
    "overview": {
      "type": "string",
      "default": ""
    },
    "branches": {
      "type": "array",
      "items": {
        "type": "object"
      },
      "default": []
    },
    "prerequisites": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "default": []
    },
    "milestones": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "default": []
    },
    "resources": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "default": []
    },
    "metrics": {
      "type": "array",
      "items": {
        "type": "string"
      },
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

### DELETE `/api/learning/skill-trees/{id}`
**Delete skill tree**

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

### GET `/api/settings/deepseek-balance`
**Get deepseek balance**

**Response:**
```json
{
  "success": "true (or structured response)"
}
```

### GET `/api/settings/deepseek-usage`
**Get deepseek usage**

**Response:**
```json
{
  "success": "true (or structured response)"
}
```

### GET `/api/settings/llm-options`
**Get llm options**

**Response:**
```json
{
  "success": "true (or structured response)"
}
```

### GET `/api/settings/usage`
**Get usage**

**Response:**
```json
{
  "success": "true (or structured response)"
}
```

### POST `/api/watch/embed-all`
**Embed all watch items**

**Response:**
```json
{
  "success": "true (or structured response)"
}
```

### GET `/api/watch/items`
**Get watch items**

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

### DELETE `/api/watch/items/{id}`
**Delete watch item**

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

### GET `/api/watch/profile`
**Get watcher profile**

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
