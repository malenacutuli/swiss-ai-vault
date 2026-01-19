"""Data Analysis Tools"""

import logging
from typing import Dict, Any, List
import json

logger = logging.getLogger(__name__)

class DataAnalyzer:
    """Analyze data and generate insights"""

    def __init__(self):
        """Initialize analyzer"""
        pass

    def analyze_dataset(
        self,
        data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Analyze dataset.

        Args:
            data: List of data records

        Returns:
            Analysis results
        """
        if not data:
            return {"error": "No data provided"}

        analysis = {
            "record_count": len(data),
            "fields": self._analyze_fields(data),
            "statistics": self._calculate_statistics(data),
            "insights": self._generate_insights(data)
        }

        return analysis

    def _analyze_fields(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze fields in dataset"""
        fields = {}

        if data:
            first_record = data[0]
            for key in first_record.keys():
                values = [record.get(key) for record in data if key in record]

                fields[key] = {
                    "type": type(values[0]).__name__ if values else "unknown",
                    "count": len(values),
                    "unique": len(set(str(v) for v in values))
                }

        return fields

    def _calculate_statistics(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate statistics"""
        stats = {}

        for record in data:
            for key, value in record.items():
                if isinstance(value, (int, float)):
                    if key not in stats:
                        stats[key] = {"min": value, "max": value, "sum": 0, "count": 0}

                    stats[key]["min"] = min(stats[key]["min"], value)
                    stats[key]["max"] = max(stats[key]["max"], value)
                    stats[key]["sum"] += value
                    stats[key]["count"] += 1

        # Calculate averages
        for key in stats:
            if stats[key]["count"] > 0:
                stats[key]["avg"] = stats[key]["sum"] / stats[key]["count"]

        return stats

    def _generate_insights(self, data: List[Dict[str, Any]]) -> List[str]:
        """Generate insights from data"""
        insights = []

        # Count records
        insights.append(f"Dataset contains {len(data)} records")

        # Identify numeric fields
        numeric_fields = []
        for record in data:
            for key, value in record.items():
                if isinstance(value, (int, float)) and key not in numeric_fields:
                    numeric_fields.append(key)

        if numeric_fields:
            insights.append(f"Numeric fields: {', '.join(numeric_fields)}")

        return insights

    def generate_chart_data(
        self,
        data: List[Dict[str, Any]],
        x_field: str,
        y_field: str
    ) -> Dict[str, Any]:
        """Generate chart data"""
        labels = []
        values = []

        for record in data:
            if x_field in record and y_field in record:
                labels.append(str(record[x_field]))
                values.append(record[y_field])

        return {
            "type": "bar",
            "labels": labels,
            "datasets": [
                {
                    "label": y_field,
                    "data": values
                }
            ]
        }
