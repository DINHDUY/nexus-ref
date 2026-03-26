# Rich Content & Advanced Examples

> [!TIP]
> All diagrams below render perfectly in light **and** dark mode!

## 1. Advanced Flowchart with Subgraphs
```mermaid
flowchart TD
    subgraph Client
        A[User] --> B[Register]
    end
    subgraph Backend
        B --> C[Create Account]
    end
```

## 2. Entity Relationship Diagram
```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ ORDER_ITEM : contains
```

## 3. Gantt Chart (Project Roadmap)
```mermaid
gantt
    title Q1 2026 Roadmap
    section Planning
    Requirements :2026-01-01, 15d
```

## 4. Git Branching Strategy
```mermaid
gitGraph
    commit id: "v1.0"
    branch develop
    commit id: "feat/auth"
```

## 5. Feature Comparison
| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Mermaid | ✅ | ✅ | ✅ |
| Dark Mode | ✅ | ✅ | ✅ |
| Versioning | ❌ | ✅ | ✅ |

## 6. Tabs (Multi-language)
# [C#](#tab/csharp)
```csharp
Console.WriteLine("Hello DocFX!");
```
# [Python](#tab/python)
```python
print("Hello DocFX!")
```

> [!WARNING]
> Keep docs in sync with code!