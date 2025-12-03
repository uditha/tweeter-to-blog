import { NextRequest, NextResponse } from 'next/server';
import { accounts } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid account ID' },
        { status: 400 }
      );
    }

    const deleted = accounts.delete(id);
    
    if (deleted) {
      return NextResponse.json({ message: 'Account deleted successfully' });
    } else {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }
  } catch (error: any) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: 'Failed to delete account', message: error.message },
      { status: 500 }
    );
  }
}

