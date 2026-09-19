from test_pipeline import service


def test_switching_target_requires_new_index_namespace(service):
    original = service.settings
    assert original.index_id != original.model_copy(update={"vector_backend": "pgvector"}).index_id
    assert original.index_id == original.model_copy(update={"vector_key": "rotated"}).index_id


def test_rebuild_from_snapshots_without_original_files(service):
    job = service.submit_record("events/1", {"value": "cached source"}, 1)
    service.run_one()
    old_revision = service.retrieve("cached")["text_results"][0]["revision"]
    assert service.rebuild() == 1
    service.run_one()
    new_revision = service.retrieve("cached")["text_results"][0]["revision"]
    assert old_revision != new_revision
    service.state.collect(service.store, service.settings.index_id)
    assert service.store.client.count(service.store.name("text")).count == 1
