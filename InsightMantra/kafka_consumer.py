import os
import json
import logging
from confluent_kafka import Consumer, KafkaError
from tasks import trigger_anomaly_scan

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
TOPIC = "po-created-events"

def start_consumer():
    logger.info(f"Connecting to Kafka at {KAFKA_BOOTSTRAP_SERVERS}...")
    
    conf = {
        'bootstrap.servers': KAFKA_BOOTSTRAP_SERVERS,
        'group.id': 'insight-mantra-group',
        'auto.offset.reset': 'earliest'
    }

    try:
        consumer = Consumer(conf)
        consumer.subscribe([TOPIC])
        logger.info(f"Subscribed to topic: {TOPIC}")

        while True:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                else:
                    logger.error(f"Kafka error: {msg.error()}")
                    break

            # Parse message
            try:
                payload = msg.value().decode('utf-8')
                data = json.loads(payload)
                logger.info(f"Received PO event: {data}")
                
                # Trigger Async AI task
                trigger_anomaly_scan.delay(data)
                
            except Exception as e:
                logger.error(f"Failed to process message: {e}")
                
    except Exception as e:
        logger.error(f"Consumer failed: {e}")
    finally:
        if 'consumer' in locals():
            consumer.close()

if __name__ == "__main__":
    start_consumer()
