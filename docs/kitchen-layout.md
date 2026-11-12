# Kitchen layout file

The kitchen screen is drawn from one JSON file. You can write it by hand, produce it with another tool, and load it in
**Pantry > Settings > Kitchen layout > Import**. **Export** writes the current one in the same format. Nothing is saved
until you press **Save**.

Coordinates are in "room units". The room is `room.width` x `room.height` (the default is 160 x 100). `x` and `y` are the
top-left corner; y grows downwards.

## Fields

| Field | Type | Notes |
| --- | --- | --- |
| `version` | `2` | Required. |
| `room` | object | `width` (60-400), `height` (40-300), `worktopY` (top of the worktop), `floorY` (where the floor starts). |
| `areas` | list | Optional. Parts of the room a phone snaps to when you drag sideways: `name`, `x`, `width`. |
| `decor` | list | Optional. Pictures with no inventory: `type` is `cooker`, `hood`, `window` or `plant`, plus `x`, `y`, `width`, `height`. |
| `hotspots` | list | The cabinets, shelves, drawers and appliances you can open. At most 60. |

### Hotspot

| Field | Type | Notes |
| --- | --- | --- |
| `key` | text | Letters, digits, `-`, `_`. Unique. Used in addresses (`?open=fridge`). |
| `name` | text | Shown on screen. |
| `door` | text | `hinged-left`, `hinged-right`, `double`, `drawer`, `open-shelf` or `glass`. Open shelves and glass cabinets show their products without opening a door. |
| `kind` | text | Kind of the pantry place if one has to be created: `fridge`, `freezer`, `shelf`, `drawer`, `cupboard`, `other`. Default `cupboard`. |
| `shelves` | 1-8 | Number of shelf boards inside (cabinets without compartments). Default 1. |
| `location` | text or `null` | Name of the pantry place it shows. Matched ignoring case. Created if it does not exist. |
| `compartments` | list | Optional, at most 12. For a fridge or freezer: labelled parts from top to bottom. |
| `x`, `y`, `width`, `height` | numbers | At least 6 x 6, and inside the room. |

### Compartment

`key` (unique inside its cabinet), `name`, `kind` (`shelf`, `drawer` or `door`) and `location` (a pantry place name, created
inside the cabinet's place when missing). Things kept directly in the cabinet's own `location` appear in a last row called
"Other".

## Example

```json
{
  "version": 2,
  "room": { "width": 100, "height": 70, "worktopY": 40, "floorY": 64 },
  "areas": [],
  "decor": [{ "type": "plant", "x": 60, "y": 28, "width": 8, "height": 12 }],
  "hotspots": [
    {
      "key": "pantry-shelf",
      "name": "Pantry shelf",
      "kind": "shelf",
      "door": "open-shelf",
      "shelves": 3,
      "location": "Dry-goods shelf",
      "x": 6, "y": 8, "width": 36, "height": 26
    },
    {
      "key": "fridge",
      "name": "Fridge",
      "kind": "fridge",
      "door": "hinged-right",
      "location": "Fridge",
      "compartments": [
        { "key": "dairy", "name": "Dairy and eggs", "kind": "shelf", "location": "Dairy and eggs" },
        { "key": "veg", "name": "Vegetables", "kind": "drawer", "location": "Vegetable drawer" }
      ],
      "x": 70, "y": 6, "width": 26, "height": 56
    }
  ]
}
```

## Rules the import checks

The whole file is rejected, with up to ten problems listed, if: the JSON is broken, `version` is not 2, a key is used
twice (hotspots, or compartments inside one cabinet), a rectangle is smaller than 6 x 6 or does not fit in the room, an
unknown `door`, `kind` or `type` is used, or `shelves` is outside 1-8.

Importing never deletes pantry places or items. Places named in the file that do not exist are created; places no longer
named stay in the pantry and can still be found in **All items**.

## From the earlier flat map

The first time the kitchen opens after migration 0009, the earlier map (`kitchen_zones`) is converted: its fridge and
freezer keep their names and places (inner zones become compartments), shelves, drawers and cupboards are put on the
free spots of the default kitchen, and anything that finds no spot is left in **All items**. The old table is not
deleted.
