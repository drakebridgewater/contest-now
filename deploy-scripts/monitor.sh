#!/bin/bash

# PDXmas Contest App - Monitoring Script for Unraid
# This script monitors the health of your deployed application

APP_DIR="/mnt/user/appdata/contest-app"
LOG_FILE="/var/log/contest-app-monitor.log"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to send notification (customize as needed)
notify() {
    local message="$1"
    local severity="${2:-INFO}"

    log "[$severity] $message"

    # Add your notification method here:
    # - Discord webhook
    # - Slack webhook
    # - Email
    # - Unraid notification system

    # Example Discord webhook (uncomment and configure):
    # if [ -n "$DISCORD_WEBHOOK_URL" ]; then
    #     curl -H "Content-Type: application/json" \
    #          -X POST \
    #          -d "{\"content\":\"🎄 PDXmas Contest App [$severity]: $message\"}" \
    #          "$DISCORD_WEBHOOK_URL"
    # fi
}

# Function to check container health
check_containers() {
    cd "$APP_DIR" || return 1

    local backend_status=$(docker-compose ps -q backend | xargs docker inspect -f '{{.State.Status}}' 2>/dev/null || echo "not_found")
    local frontend_status=$(docker-compose ps -q frontend | xargs docker inspect -f '{{.State.Status}}' 2>/dev/null || echo "not_found")

    if [ "$backend_status" != "running" ]; then
        notify "Backend container is not running (Status: $backend_status)" "ERROR"
        return 1
    fi

    if [ "$frontend_status" != "running" ]; then
        notify "Frontend container is not running (Status: $frontend_status)" "ERROR"
        return 1
    fi

    return 0
}

# Function to check API health
check_api_health() {
    local backend_health=$(curl -f -s -m 10 http://localhost:3001/api/health 2>/dev/null || echo "failed")
    local frontend_health=$(curl -f -s -m 10 http://localhost:3099/ 2>/dev/null || echo "failed")

    if [ "$backend_health" = "failed" ]; then
        notify "Backend API health check failed" "ERROR"
        return 1
    fi

    if [ "$frontend_health" = "failed" ]; then
        notify "Frontend health check failed" "ERROR"
        return 1
    fi

    return 0
}

# Function to check disk space
check_disk_space() {
    local available_gb=$(df "$APP_DIR" | tail -1 | awk '{print int($4/1024/1024)}')

    if [ "$available_gb" -lt 1 ]; then  # Less than 1GB
        notify "Low disk space: ${available_gb}GB remaining" "WARNING"
        return 1
    elif [ "$available_gb" -lt 5 ]; then  # Less than 5GB
        notify "Disk space warning: ${available_gb}GB remaining" "INFO"
    fi

    return 0
}

# Function to check memory usage
check_memory_usage() {
    cd "$APP_DIR" || return 1

    local backend_mem=$(docker stats --no-stream --format "{{.MemPerc}}" $(docker-compose ps -q backend) 2>/dev/null | sed 's/%//' || echo "0")
    local frontend_mem=$(docker stats --no-stream --format "{{.MemPerc}}" $(docker-compose ps -q frontend) 2>/dev/null | sed 's/%//' || echo "0")

    # Convert to integer for comparison
    backend_mem=$(echo "$backend_mem" | cut -d. -f1)
    frontend_mem=$(echo "$frontend_mem" | cut -d. -f1)

    if [ "$backend_mem" -gt 80 ]; then
        notify "High backend memory usage: ${backend_mem}%" "WARNING"
    fi

    if [ "$frontend_mem" -gt 80 ]; then
        notify "High frontend memory usage: ${frontend_mem}%" "WARNING"
    fi
}

# Function to check database integrity
check_database() {
    if [ -f "$APP_DIR/data/contest.db" ]; then
        # Simple check to see if database file is accessible
        if ! sqlite3 "$APP_DIR/data/contest.db" "SELECT COUNT(*) FROM sqlite_master;" >/dev/null 2>&1; then
            notify "Database integrity check failed" "ERROR"
            return 1
        fi
    else
        notify "Database file not found" "WARNING"
        return 1
    fi

    return 0
}

# Function to auto-heal services
auto_heal() {
    local service="$1"

    notify "Attempting to auto-heal $service" "INFO"

    cd "$APP_DIR" || return 1

    if [ "$service" = "all" ]; then
        docker-compose restart
    else
        docker-compose restart "$service"
    fi

    sleep 30  # Wait for service to start

    if check_containers && check_api_health; then
        notify "Auto-heal successful for $service" "INFO"
        return 0
    else
        notify "Auto-heal failed for $service" "ERROR"
        return 1
    fi
}

# Main monitoring function
main() {
    local action="${1:-monitor}"

    case "$action" in
        monitor)
            log "Starting health check..."

            local issues=0

            # Check containers
            if ! check_containers; then
                issues=$((issues + 1))
                auto_heal "all"  # Try to restart all services
            fi

            # Check API health
            if ! check_api_health; then
                issues=$((issues + 1))
                if [ $issues -le 1 ]; then  # Only try healing if not already healing
                    auto_heal "all"
                fi
            fi

            # Check resources (don't auto-heal for these)
            check_disk_space
            check_memory_usage
            check_database

            if [ $issues -eq 0 ]; then
                log "All health checks passed ✅"
            else
                log "Health check completed with $issues issues ⚠️"
            fi
            ;;

        status)
            echo "🎄 PDXmas Contest App Status"
            echo "=========================="
            echo
            cd "$APP_DIR" || exit 1

            echo "📊 Container Status:"
            docker-compose ps
            echo

            echo "💻 Resource Usage:"
            docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" $(docker-compose ps -q)
            echo

            echo "💾 Disk Usage:"
            df -h "$APP_DIR" | tail -1
            echo

            echo "🗄️ Database Info:"
            if [ -f "$APP_DIR/data/contest.db" ]; then
                echo "   Database file exists: $(ls -lh "$APP_DIR/data/contest.db" | awk '{print $5" "$6" "$7" "$8}')"
                echo "   Entry count: $(sqlite3 "$APP_DIR/data/contest.db" "SELECT COUNT(*) FROM entries;" 2>/dev/null || echo "unknown")"
                echo "   Vote count: $(sqlite3 "$APP_DIR/data/contest.db" "SELECT COUNT(*) FROM votes;" 2>/dev/null || echo "unknown")"
            else
                echo "   Database file not found"
            fi
            echo

            echo "🌐 Endpoints:"
            echo "   Frontend: http://$(hostname -I | awk '{print $1}'):3099"
            echo "   Backend API: http://$(hostname -I | awk '{print $1}'):3001/api/health"
            echo

            echo "📝 Recent logs:"
            tail -10 "$LOG_FILE" 2>/dev/null || echo "   No monitor logs found"
            ;;

        logs)
            echo "📋 Recent Application Logs:"
            echo "=========================="
            cd "$APP_DIR" || exit 1
            docker-compose logs --tail=50
            ;;

        heal)
            local service="${2:-all}"
            auto_heal "$service"
            ;;

        *)
            echo "PDXmas Contest App Monitor"
            echo "Usage: $0 {monitor|status|logs|heal [service]}"
            echo
            echo "Commands:"
            echo "  monitor  - Run health checks and auto-healing"
            echo "  status   - Show application status"
            echo "  logs     - Show recent application logs"
            echo "  heal     - Attempt to heal services (all|backend|frontend)"
            echo
            echo "Examples:"
            echo "  $0 monitor    # Run full health check"
            echo "  $0 status     # Show current status"
            echo "  $0 heal backend  # Restart backend service"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
