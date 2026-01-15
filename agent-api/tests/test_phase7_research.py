import pytest
from app.research.job_manager import WideResearchJobManager, JobStatus
from app.research.coordinator import ParallelAgentCoordinator
from app.research.synthesizer import ResultSynthesizer

@pytest.fixture
def job_manager():
    return WideResearchJobManager()

@pytest.fixture
def synthesizer():
    return ResultSynthesizer()

def test_create_job(job_manager):
    """Test creating research job"""
    job = job_manager.create_job(
        topic="Artificial Intelligence",
        num_agents=5
    )

    assert job.topic == "Artificial Intelligence"
    assert job.status == JobStatus.PENDING

def test_job_lifecycle(job_manager):
    """Test job lifecycle"""
    job = job_manager.create_job("Test Topic")

    job_manager.start_job(job.job_id)
    assert job.status == JobStatus.RUNNING

    job_manager.complete_job(job.job_id)
    assert job.status == JobStatus.COMPLETED

def test_add_subtasks(job_manager):
    """Test adding subtasks"""
    job = job_manager.create_job("Test")

    job_manager.add_subtask(job.job_id, {"query": "test1"})
    job_manager.add_subtask(job.job_id, {"query": "test2"})

    assert len(job.subtasks) == 2

def test_synthesize_results(synthesizer):
    """Test result synthesis"""
    results = [
        {
            "aspect": "overview",
            "summary": "AI is transforming industries",
            "findings": ["Finding 1", "Finding 2"],
            "confidence": 0.9
        },
        {
            "aspect": "recent_developments",
            "summary": "New models released",
            "findings": ["Finding 3"],
            "confidence": 0.85
        }
    ]

    synthesis = synthesizer.synthesize("AI", results)

    assert synthesis["topic"] == "AI"
    assert len(synthesis["key_findings"]) > 0
    assert synthesis["confidence"] > 0

def test_job_to_dict(job_manager):
    """Test job serialization"""
    job = job_manager.create_job("Test Topic", num_agents=3, max_depth=2)

    job_dict = job.to_dict()

    assert job_dict["topic"] == "Test Topic"
    assert job_dict["num_agents"] == 3
    assert job_dict["max_depth"] == 2
    assert job_dict["status"] == "pending"

def test_update_progress(job_manager):
    """Test progress tracking"""
    job = job_manager.create_job("Test")

    job_manager.update_progress(job.job_id, 50)
    assert job.progress == 50

    job_manager.update_progress(job.job_id, 150)  # Should cap at 100
    assert job.progress == 100

    job_manager.update_progress(job.job_id, -10)  # Should floor at 0
    assert job.progress == 0

def test_fail_job(job_manager):
    """Test job failure handling"""
    job = job_manager.create_job("Test")

    job_manager.fail_job(job.job_id, "Test error")
    assert job.status == JobStatus.FAILED
    assert job.completed_at is not None

def test_add_results(job_manager):
    """Test adding results to job"""
    job = job_manager.create_job("Test")

    result1 = {"aspect": "overview", "summary": "Test1"}
    result2 = {"aspect": "details", "summary": "Test2"}

    job_manager.add_result(job.job_id, result1)
    job_manager.add_result(job.job_id, result2)

    assert len(job.results) == 2

def test_list_jobs(job_manager):
    """Test listing all jobs"""
    job_manager.create_job("Topic 1")
    job_manager.create_job("Topic 2")
    job_manager.create_job("Topic 3")

    jobs = job_manager.list_jobs()
    assert len(jobs) == 3

def test_synthesizer_empty_results(synthesizer):
    """Test synthesizer with no results"""
    synthesis = synthesizer.synthesize("Empty Topic", [])

    assert synthesis["topic"] == "Empty Topic"
    assert synthesis["findings"] == []

def test_synthesizer_confidence_calculation(synthesizer):
    """Test confidence score calculation"""
    results = [
        {"confidence": 0.9},
        {"confidence": 0.8},
        {"confidence": 0.7}
    ]

    synthesis = synthesizer.synthesize("Test", results)

    # Average confidence: (0.9 + 0.8 + 0.7) / 3 = 0.8
    assert abs(synthesis["confidence"] - 0.8) < 0.01

def test_synthesizer_group_results(synthesizer):
    """Test result grouping by aspect"""
    results = [
        {"aspect": "overview", "summary": "Overview summary"},
        {"aspect": "overview", "summary": "Another overview"},
        {"aspect": "details", "summary": "Details summary"}
    ]

    grouped = synthesizer._group_results(results)

    assert len(grouped["overview"]) == 2
    assert len(grouped["details"]) == 1

def test_synthesizer_source_collection(synthesizer):
    """Test unique source collection"""
    results = [
        {"sources": ["source1", "source2"]},
        {"sources": ["source2", "source3"]},
        {"sources": ["source1"]}
    ]

    sources = synthesizer._collect_sources(results)

    # Should have unique sources
    assert len(sources) == 3
    assert set(sources) == {"source1", "source2", "source3"}

def test_job_get_nonexistent(job_manager):
    """Test getting non-existent job"""
    job = job_manager.get_job("non-existent-id")
    assert job is None

def test_start_nonexistent_job(job_manager):
    """Test starting non-existent job"""
    result = job_manager.start_job("non-existent-id")
    assert result is False

def test_synthesizer_findings_limit(synthesizer):
    """Test that synthesizer limits findings to top 10"""
    results = [{
        "findings": [f"Finding {i}" for i in range(20)]
    }]

    synthesis = synthesizer.synthesize("Test", results)

    # Should only return top 10
    assert len(synthesis["key_findings"]) == 10

def test_synthesizer_recommendations_limit(synthesizer):
    """Test that synthesizer limits recommendations to top 5"""
    results = [{
        "recommendations": [f"Recommendation {i}" for i in range(15)]
    }]

    synthesis = synthesizer.synthesize("Test", results)

    # Should only return top 5
    assert len(synthesis["recommendations"]) == 5

@pytest.mark.asyncio
async def test_coordinator_create_subtasks():
    """Test subtask creation"""
    job_manager = WideResearchJobManager()

    async def mock_executor(**kwargs):
        return {"status": "success"}

    coordinator = ParallelAgentCoordinator(job_manager, mock_executor)

    subtasks = coordinator._create_subtasks("AI Research", num_agents=5)

    assert len(subtasks) == 5
    assert all("aspect" in task for task in subtasks)
    assert all("query" in task for task in subtasks)

@pytest.mark.asyncio
async def test_coordinator_distribute_research():
    """Test research distribution across agents"""
    job_manager = WideResearchJobManager()
    job = job_manager.create_job("Test Topic", num_agents=3)

    async def mock_executor(job_id, subtask, topic):
        return {
            "aspect": subtask["aspect"],
            "summary": f"Summary for {subtask['aspect']}",
            "confidence": 0.8
        }

    coordinator = ParallelAgentCoordinator(job_manager, mock_executor)

    result = await coordinator.distribute_research(
        job_id=job.job_id,
        topic="Test Topic",
        num_agents=3
    )

    assert result["status"] == "completed"
    assert len(result["results"]) == 3
    assert job.status == JobStatus.COMPLETED
