# ReplyMate AI Backend API Documentation

Base URL: `http://localhost:4000`

## `POST` /api/chat/message

### Headers

| Name | Type | Required | Description |
|---|---|---|---|
| `X-LLM-Provider` | `string` | No |  |
| `X-LLM-Model` | `string` | No |  |
| `X-LLM-Reasoning` | `string` | No |  |

### Request Body

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

## `POST` /api/coach/analyze

### Headers

| Name | Type | Required | Description |
|---|---|---|---|
| `X-LLM-Provider` | `string` | No |  |
| `X-LLM-Model` | `string` | No |  |
| `X-LLM-Reasoning` | `string` | No |  |

### Request Body

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

## `POST` /api/creator/repurpose

### Headers

| Name | Type | Required | Description |
|---|---|---|---|
| `X-LLM-Provider` | `string` | No |  |
| `X-LLM-Model` | `string` | No |  |
| `X-LLM-Reasoning` | `string` | No |  |

### Request Body

Uses schema: **CreatorRepurposeInput**

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

## `POST` /api/decision/simulate

### Headers

| Name | Type | Required | Description |
|---|---|---|---|
| `X-LLM-Provider` | `string` | No |  |
| `X-LLM-Model` | `string` | No |  |
| `X-LLM-Reasoning` | `string` | No |  |

### Request Body

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

## `POST` /api/expense/create

### Headers

| Name | Type | Required | Description |
|---|---|---|---|
| `X-LLM-Provider` | `string` | No |  |
| `X-LLM-Model` | `string` | No |  |
| `X-LLM-Reasoning` | `string` | No |  |

### Request Body

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

## `POST` /api/expense/message

### Headers

| Name | Type | Required | Description |
|---|---|---|---|
| `X-LLM-Provider` | `string` | No |  |
| `X-LLM-Model` | `string` | No |  |
| `X-LLM-Reasoning` | `string` | No |  |

### Request Body

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

## `POST` /api/expense/intelligence

### Headers

| Name | Type | Required | Description |
|---|---|---|---|
| `X-LLM-Provider` | `string` | No |  |
| `X-LLM-Model` | `string` | No |  |
| `X-LLM-Reasoning` | `string` | No |  |

### Request Body

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

## `POST` /api/learning/skill-tree

### Headers

| Name | Type | Required | Description |
|---|---|---|---|
| `X-LLM-Provider` | `string` | No |  |
| `X-LLM-Model` | `string` | No |  |
| `X-LLM-Reasoning` | `string` | No |  |

### Request Body

Uses schema: **SkillTreeInput**

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

## `POST` /api/learning/roadmap

### Headers

| Name | Type | Required | Description |
|---|---|---|---|
| `X-LLM-Provider` | `string` | No |  |
| `X-LLM-Model` | `string` | No |  |
| `X-LLM-Reasoning` | `string` | No |  |

### Request Body

Uses schema: **LearningRoadmapInput**

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

## `POST` /api/replies/generate

### Headers

| Name | Type | Required | Description |
|---|---|---|---|
| `X-LLM-Provider` | `string` | No |  |
| `X-LLM-Model` | `string` | No |  |
| `X-LLM-Reasoning` | `string` | No |  |

### Request Body

Uses schema: **GenerateRepliesInput**

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

## `POST` /api/replies/rewrite

### Headers

| Name | Type | Required | Description |
|---|---|---|---|
| `X-LLM-Provider` | `string` | No |  |
| `X-LLM-Model` | `string` | No |  |
| `X-LLM-Reasoning` | `string` | No |  |

### Request Body

Uses schema: **GenerateRepliesInput**

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

## `POST` /api/replies/grammar

### Headers

| Name | Type | Required | Description |
|---|---|---|---|
| `X-LLM-Provider` | `string` | No |  |
| `X-LLM-Model` | `string` | No |  |
| `X-LLM-Reasoning` | `string` | No |  |

### Request Body

Uses schema: **GenerateRepliesInput**

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

## `POST` /api/watch/log

### Headers

| Name | Type | Required | Description |
|---|---|---|---|
| `X-LLM-Provider` | `string` | No |  |
| `X-LLM-Model` | `string` | No |  |
| `X-LLM-Reasoning` | `string` | No |  |

### Request Body

Uses schema: **LogWatchInput**

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

## `PATCH` /api/watch/items/{id}

### Headers

| Name | Type | Required | Description |
|---|---|---|---|
| `X-LLM-Provider` | `string` | No |  |
| `X-LLM-Model` | `string` | No |  |
| `X-LLM-Reasoning` | `string` | No |  |

### Path Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes |  |

### Request Body

Uses schema: **UpdateWatchDetailsInput**

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

## `PATCH` /api/watch/items/{id}/status

### Headers

| Name | Type | Required | Description |
|---|---|---|---|
| `X-LLM-Provider` | `string` | No |  |
| `X-LLM-Model` | `string` | No |  |
| `X-LLM-Reasoning` | `string` | No |  |

### Path Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes |  |

### Request Body

Uses schema: **UpdateWatchStatusInput**

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

## `POST` /api/watch/search

### Headers

| Name | Type | Required | Description |
|---|---|---|---|
| `X-LLM-Provider` | `string` | No |  |
| `X-LLM-Model` | `string` | No |  |
| `X-LLM-Reasoning` | `string` | No |  |

### Request Body

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

## `POST` /api/decisions/simulate

### Request Body

Uses schema: **DecisionSimulateInput**

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

## `POST` /api/expenses/create

### Request Body

Uses schema: **ExpenseCreateInput**

```json
{
  "type": "object",
  "properties": {
    "amount": {
      "type": "number",
      "exclusiveMinimum": true,
      "minimum": 0
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

## `POST` /api/expenses/message

### Request Body

Uses schema: **ExpenseMessageInput**

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

## `POST` /api/expenses/intelligence

### Request Body

Uses schema: **ExpenseIntelligenceInput**

```json
{
  "type": "object",
  "properties": {
    "period": {
      "type": "string",
      "default": "month"
    }
  },
  "additionalProperties": false
}
```

## `POST` /api/recurring/create

### Request Body

Uses schema: **RecurringCreateInput**

```json
{
  "type": "object",
  "properties": {
    "amount": {
      "type": "number",
      "exclusiveMinimum": true,
      "minimum": 0
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
      "minLength": 1,
      "maxLength": 160
    },
    "frequency": {
      "type": "string",
      "enum": [
        "daily",
        "weekly",
        "monthly",
        "yearly"
      ]
    },
    "startDate": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    }
  },
  "required": [
    "amount",
    "category",
    "description",
    "frequency"
  ],
  "additionalProperties": false
}
```

## `PUT` /api/recurring/{id}

### Request Body

Uses schema: **RecurringUpdateInput**

```json
{
  "type": "object",
  "properties": {
    "amount": {
      "type": "number",
      "exclusiveMinimum": true,
      "minimum": 0
    },
    "currency": {
      "type": "string",
      "enum": [
        "AED",
        "INR"
      ]
    },
    "category": {
      "type": "string",
      "maxLength": 80
    },
    "description": {
      "type": "string",
      "maxLength": 160
    },
    "frequency": {
      "type": "string",
      "enum": [
        "daily",
        "weekly",
        "monthly",
        "yearly"
      ]
    },
    "nextDueDate": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "isActive": {
      "type": "boolean"
    }
  },
  "additionalProperties": false
}
```

## `POST` /api/watch/resolve-title

### Request Body

Uses schema: **ResolveTitleInput**

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

## `GET` /api/watch/search-titles

### Query Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `q` | `string` | Yes |  |
| `type` | `movie | series` | No |  |

## Components

### Schemas

#### CreatorRepurposeInput

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

#### DecisionSimulateInput

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

#### ExpenseMessageInput

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

#### ExpenseCreateInput

```json
{
  "type": "object",
  "properties": {
    "amount": {
      "type": "number",
      "exclusiveMinimum": true,
      "minimum": 0
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

#### ExpenseIntelligenceInput

```json
{
  "type": "object",
  "properties": {
    "period": {
      "type": "string",
      "default": "month"
    }
  },
  "additionalProperties": false
}
```

#### SkillTreeInput

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

#### LearningRoadmapInput

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

#### RecurringCreateInput

```json
{
  "type": "object",
  "properties": {
    "amount": {
      "type": "number",
      "exclusiveMinimum": true,
      "minimum": 0
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
      "minLength": 1,
      "maxLength": 160
    },
    "frequency": {
      "type": "string",
      "enum": [
        "daily",
        "weekly",
        "monthly",
        "yearly"
      ]
    },
    "startDate": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    }
  },
  "required": [
    "amount",
    "category",
    "description",
    "frequency"
  ],
  "additionalProperties": false
}
```

#### RecurringUpdateInput

```json
{
  "type": "object",
  "properties": {
    "amount": {
      "type": "number",
      "exclusiveMinimum": true,
      "minimum": 0
    },
    "currency": {
      "type": "string",
      "enum": [
        "AED",
        "INR"
      ]
    },
    "category": {
      "type": "string",
      "maxLength": 80
    },
    "description": {
      "type": "string",
      "maxLength": 160
    },
    "frequency": {
      "type": "string",
      "enum": [
        "daily",
        "weekly",
        "monthly",
        "yearly"
      ]
    },
    "nextDueDate": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "isActive": {
      "type": "boolean"
    }
  },
  "additionalProperties": false
}
```

#### GenerateRepliesInput

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

#### LogWatchInput

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

#### UpdateWatchStatusInput

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

#### UpdateWatchDetailsInput

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

#### ResolveTitleInput

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
