from flask import Blueprint, request, jsonify
from backend.database import db
from backend.models.log_analysis import LogAnalysis
from backend.models.uploaded_file import UploadedFile
from backend.routes.auth import token_required
import json, os

history_bp = Blueprint('history', __name__)

@history_bp.route('/')
@token_required
def get_history(current_user):
    """Get all analyses for the current user"""
    try:
        analyses = LogAnalysis.query.filter_by(
            user_id=current_user.id
        ).order_by(LogAnalysis.created_at.desc()).all()
        
        items = []
        for a in analyses:
            items.append({
                'id': a.id,
                'filename': a.filename,
                'title': a.filename or 'Analysis',
                'total_entries': a.total_entries or 0,
                'threats': a.threats_found or 0,
                'log_levels': json.loads(a.log_levels) if a.log_levels else {},
                'created_at': a.created_at.isoformat() if a.created_at else None,
                'has_ml': a.ml_result is not None,
                'has_mitre': a.mitre_matches is not None
            })
        
        return jsonify({'items': items, 'total': len(items)})
    except Exception as e:
        return jsonify({'message': str(e)}), 500

@history_bp.route('/<int:item_id>', methods=['DELETE'])
@token_required
def delete_single(current_user, item_id):
    """Delete a single analysis"""
    try:
        analysis = LogAnalysis.query.filter_by(
            id=item_id, user_id=current_user.id
        ).first()
        if not analysis:
            return jsonify({'message': 'Item not found'}), 404
        
        # Delete associated uploaded file if exists
        if analysis.file_id:
            uploaded = UploadedFile.query.get(analysis.file_id)
            if uploaded:
                if uploaded.filepath and os.path.exists(uploaded.filepath):
                    try:
                        os.remove(uploaded.filepath)
                    except:
                        pass
                db.session.delete(uploaded)
        
        db.session.delete(analysis)
        db.session.commit()
        return jsonify({'message': 'Deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500

@history_bp.route('/batch', methods=['DELETE'])
@token_required  
def delete_batch(current_user):
    """Delete multiple analyses by IDs"""
    try:
        data = request.get_json()
        ids = data.get('ids', [])
        if not ids:
            return jsonify({'message': 'No IDs provided'}), 400
        
        analyses = LogAnalysis.query.filter(
            LogAnalysis.id.in_(ids),
            LogAnalysis.user_id == current_user.id
        ).all()
        
        for analysis in analyses:
            if analysis.file_id:
                uploaded = UploadedFile.query.get(analysis.file_id)
                if uploaded:
                    if uploaded.filepath and os.path.exists(uploaded.filepath):
                        try:
                            os.remove(uploaded.filepath)
                        except:
                            pass
                    db.session.delete(uploaded)
            db.session.delete(analysis)
        
        db.session.commit()
        return jsonify({'message': f'Deleted {len(analyses)} items'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500

@history_bp.route('/all', methods=['DELETE'])
@token_required
def delete_all(current_user):
    """Clear all history for current user"""
    try:
        analyses = LogAnalysis.query.filter_by(user_id=current_user.id).all()
        
        for analysis in analyses:
            if analysis.file_id:
                uploaded = UploadedFile.query.get(analysis.file_id)
                if uploaded:
                    if uploaded.filepath and os.path.exists(uploaded.filepath):
                        try:
                            os.remove(uploaded.filepath)
                        except:
                            pass
                    db.session.delete(uploaded)
            db.session.delete(analysis)
        
        db.session.commit()
        return jsonify({'message': 'All history cleared'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500
