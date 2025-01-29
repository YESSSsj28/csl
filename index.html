import random
import os
import time

# Game settings
MAP_SIZE = 10
PLAYER_HEALTH = 100
SAFE_ZONE_RADIUS = 5
SHRINK_SPEED = 0.5
DAMAGE_OUTSIDE_ZONE = 5

# Player and game state
player = {"x": 0, "y": 0, "health": PLAYER_HEALTH, "weapon": "Fists", "ammo": 0}
bots = [{"x": random.randint(0, MAP_SIZE-1), "y": random.randint(0, MAP_SIZE-1), "health": 50} for _ in range(5)]
loot = [{"x": random.randint(0, MAP_SIZE-1), "y": random.randint(0, MAP_SIZE-1), "type": random.choice(["Weapon", "Health", "Ammo"])} for _ in range(10)]
safe_zone_center = {"x": MAP_SIZE // 2, "y": MAP_SIZE // 2}
safe_zone_radius = SAFE_ZONE_RADIUS

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def draw_map():
    for y in range(MAP_SIZE):
        for x in range(MAP_SIZE):
            if x == player["x"] and y == player["y"]:
                print("P", end=" ")
            elif any(bot["x"] == x and bot["y"] == y for bot in bots):
                print("B", end=" ")
            elif any(item["x"] == x and item["y"] == y for item in loot):
                print("L", end=" ")
            elif (x - safe_zone_center["x"])**2 + (y - safe_zone_center["y"])**2 <= safe_zone_radius**2:
                print(".", end=" ")
            else:
                print("#", end=" ")
        print()

def move_player(dx, dy):
    player["x"] = max(0, min(MAP_SIZE-1, player["x"] + dx))
    player["y"] = max(0, min(MAP_SIZE-1, player["y"] + dy))

def check_loot():
    for item in loot[:]:
        if item["x"] == player["x"] and item["y"] == player["y"]:
            if item["type"] == "Weapon":
                player["weapon"] = "Pistol"
                player["ammo"] += 10
                print("You found a Pistol and 10 ammo!")
            elif item["type"] == "Health":
                player["health"] = min(100, player["health"] + 20)
                print("You found a Health pack and restored 20 HP!")
            elif item["type"] == "Ammo":
                player["ammo"] += 5
                print("You found 5 ammo!")
            loot.remove(item)

def move_bots():
    for bot in bots:
        if random.random() < 0.5:
            bot["x"] += random.choice([-1, 0, 1])
            bot["x"] = max(0, min(MAP_SIZE-1, bot["x"]))
        else:
            bot["y"] += random.choice([-1, 0, 1])
            bot["y"] = max(0, min(MAP_SIZE-1, bot["y"]))

def check_combat():
    for bot in bots[:]:
        if bot["x"] == player["x"] and bot["y"] == player["y"]:
            if player["weapon"] == "Pistol" and player["ammo"] > 0:
                player["ammo"] -= 1
                bot["health"] -= 20
                print("You shot the bot for 20 damage!")
            else:
                player["health"] -= 10
                print("The bot attacked you for 10 damage!")
            if bot["health"] <= 0:
                bots.remove(bot)
                print("You defeated a bot!")

def update_safe_zone():
    global safe_zone_radius
    safe_zone_radius -= SHRINK_SPEED
    if safe_zone_radius < 1:
        safe_zone_radius = 1

def check_safe_zone():
    distance_to_center = (player["x"] - safe_zone_center["x"])**2 + (player["y"] - safe_zone_center["y"])**2
    if distance_to_center > safe_zone_radius**2:
        player["health"] -= DAMAGE_OUTSIDE_ZONE
        print(f"You took {DAMAGE_OUTSIDE_ZONE} damage from being outside the safe zone!")

def game_over():
    if player["health"] <= 0:
        print("You died! Game over.")
        return True
    if len(bots) == 0:
        print("You defeated all the bots! You win!")
        return True
    return False

def main():
    while True:
        clear_screen()
        print(f"Health: {player['health']} | Weapon: {player['weapon']} | Ammo: {player['ammo']}")
        print(f"Safe Zone Radius: {int(safe_zone_radius)}")
        draw_map()

        # Player input
        move = input("Move (WASD): ").lower()
        if move == "w":
            move_player(0, -1)
        elif move == "a":
            move_player(-1, 0)
        elif move == "s":
            move_player(0, 1)
        elif move == "d":
            move_player(1, 0)
        else:
            print("Invalid move! Use WASD.")
            time.sleep(1)
            continue

        # Game logic
        check_loot()
        move_bots()
        check_combat()
        update_safe_zone()
        check_safe_zone()

        # Check for game over
        if game_over():
            break

        time.sleep(1)

if __name__ == "__main__":
    main()
